//! Connect's saved NAS devices (`nas.json` beside `peers.json`, 0600): one entry per host +
//! port, an SMB share, an FTP server or an NFS server (each a source and an output), saved
//! from Discover (mDNS) or added by address, with optional credentials (none for NFS: it has
//! no login). The password is never logged and never in a reply (`NasDevice::has_password`).
//! ponytail: the password is plaintext at rest (the file is 0600, like the node secret).

use std::collections::HashSet;
use std::fs;
use std::io;
use std::net::{IpAddr, TcpStream, ToSocketAddrs};
use std::path::Path;
use std::time::Duration;

use serde::{Deserialize, Serialize};

pub const NAS_FILE: &str = "nas.json";
/// SMB.
pub const DEFAULT_PORT: u16 = 445;
/// FTP.
pub const FTP_PORT: u16 = 21;
/// NFS.
pub const NFS_PORT: u16 = 2049;

/// How a saved NAS is reached: `smb://` (the default, as every entry before FTP), `ftp://` or
/// `nfs://`. Spelled as mDNS's `Nas::service` for SMB and NFS, so Discover's Save can pass it on.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Protocol {
    #[default]
    Smb,
    Ftp,
    Nfs,
}

impl Protocol {
    fn default_port(self) -> u16 {
        match self {
            Self::Smb => DEFAULT_PORT,
            Self::Ftp => FTP_PORT,
            Self::Nfs => NFS_PORT,
        }
    }

    /// As a search names it (`mdns::Nas::service`).
    fn service(self) -> &'static str {
        match self {
            Self::Smb => "smb",
            Self::Ftp => "ftp",
            Self::Nfs => "nfs",
        }
    }
}

/// A saved NAS as stored (with its password: never serialized anywhere but `nas.json`).
#[derive(Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SavedNas {
    /// Stable across address changes: `nas-` + 8 random hex digits.
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    #[serde(default)]
    pub protocol: Protocol,
    /// Empty: guest (anonymous for FTP; always empty for NFS).
    #[serde(default)]
    pub user: String,
    #[serde(default)]
    pub password: String,
}

impl std::fmt::Debug for SavedNas {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("SavedNas")
            .field("id", &self.id)
            .field("name", &self.name)
            .field("host", &self.host)
            .field("port", &self.port)
            .field("protocol", &self.protocol)
            .field("user", &self.user)
            .field("has_password", &!self.password.is_empty())
            .finish()
    }
}

/// A saved NAS as the UI lists it.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct NasDevice {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub protocol: Protocol,
    pub user: String,
    pub has_password: bool,
    pub online: bool,
    /// Unix seconds of the last probe that reached it since start; 0 = none.
    pub last_online: u64,
}

/// What a save asks for. `user`/`password` `None` keep the saved ones (Discover's Save sends
/// none); `Some("")` clears them. NFS has no login: a save as NFS drops both (an entry
/// switched to NFS loses its old ones). `id`: the saved entry an edit changes (its address too).
#[derive(Clone, Default, Deserialize)]
pub struct NasSave {
    #[serde(default)]
    pub id: Option<String>,
    #[serde(default)]
    pub name: String,
    pub host: String,
    #[serde(default)]
    pub port: Option<u16>,
    /// `None` keeps an entry's protocol; a new one is SMB.
    #[serde(default)]
    pub protocol: Option<Protocol>,
    #[serde(default)]
    pub user: Option<String>,
    #[serde(default)]
    pub password: Option<String>,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct NasList {
    pub nas: Vec<SavedNas>,
}

/// `host`, `host:port` or `[v6]:port` → (host, port); the port defaults to `default` (445 for
/// SMB, 21 for FTP, 2049 for NFS).
pub fn parse_host(text: &str, port: Option<u16>, default: u16) -> io::Result<(String, u16)> {
    let t = text.trim();
    let bad = || {
        io::Error::new(
            io::ErrorKind::InvalidInput,
            format!("{t:?} is not an address"),
        )
    };
    let (host, from_text) = if let Some(rest) = t.strip_prefix('[') {
        let (h, after) = rest.split_once(']').ok_or_else(bad)?;
        (h, after.strip_prefix(':'))
    } else if t.matches(':').count() == 1 {
        let (h, p) = t.split_once(':').ok_or_else(bad)?;
        (h, Some(p))
    } else {
        (t, None)
    };
    let port = match from_text {
        Some(p) => p.parse::<u16>().ok().filter(|p| *p != 0).ok_or_else(bad)?,
        None => port.unwrap_or(default),
    };
    if host.is_empty() || host.contains(['/', '\\', ' ', '\0']) {
        return Err(bad());
    }
    Ok((host.to_ascii_lowercase(), port))
}

impl NasList {
    /// Hands every saved login to core: SMB ones to its `smb://` registry, FTP ones to its
    /// `ftp://` one, replacing the last set. NFS has none to hand: core's `nfs://` reaches any
    /// server by its address alone (AUTH_SYS).
    pub fn publish(&self) {
        let ftp = |n: &&SavedNas| n.protocol == Protocol::Ftp;
        let authority = |n: &SavedNas| match n.port {
            FTP_PORT => n.host.clone(),
            p if n.host.contains(':') => format!("[{}]:{p}", n.host),
            p => format!("{}:{p}", n.host),
        };
        ps5_dump_forge_core::ftp::set_logins(
            (self.nas.iter().filter(ftp))
                .filter_map(|n| {
                    Some(ps5_dump_forge_core::ftp::FtpLogin {
                        authority: ps5_dump_forge_core::ftp::authority(&authority(n))?,
                        user: n.user.clone(),
                        password: n.password.clone(),
                    })
                })
                .collect(),
        );
        ps5_dump_forge_core::smb::set_credentials(
            self.nas
                .iter()
                .filter(|n| n.protocol == Protocol::Smb)
                .map(|n| ps5_dump_forge_core::smb::SmbCredential {
                    host: n.host.clone(),
                    port: n.port,
                    user: n.user.clone(),
                    password: n.password.clone(),
                })
                .collect(),
        );
    }

    pub fn load(dir: &Path) -> io::Result<NasList> {
        let path = dir.join(NAS_FILE);
        match fs::read(&path) {
            Ok(b) => serde_json::from_slice(&b).map_err(|e| {
                io::Error::new(
                    io::ErrorKind::InvalidData,
                    format!("{}: {e}", path.display()),
                )
            }),
            Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(NasList::default()),
            Err(e) => Err(e),
        }
    }

    pub fn save(&self, dir: &Path) -> io::Result<()> {
        fs::create_dir_all(dir)?;
        let json = serde_json::to_vec_pretty(self).map_err(io::Error::other)?;
        crate::connect::write_atomic(&dir.join(NAS_FILE), &json)
    }

    /// Adds the NAS at `req`'s host + port, or updates that one entry in place (its name, and
    /// the credentials the request names); returns its id. Never a duplicate.
    pub fn upsert(&mut self, req: &NasSave) -> io::Result<String> {
        let edited = req
            .id
            .as_ref()
            .and_then(|id| self.nas.iter().position(|n| &n.id == id));
        // Naming none keeps the protocol of the entry it edits or saves again (an SMB default
        // address finds it), else SMB.
        let protocol = req
            .protocol
            .or_else(|| edited.map(|e| self.nas[e].protocol))
            .or_else(|| {
                let (host, port) = parse_host(&req.host, req.port, DEFAULT_PORT).ok()?;
                let found = self.nas.iter().find(|n| n.host == host && n.port == port);
                found.map(|n| n.protocol)
            })
            .unwrap_or_default();
        let (host, port) = parse_host(&req.host, req.port, protocol.default_port())?;
        let name = match req.name.trim() {
            "" => host.clone(),
            n => n.to_string(),
        };
        let at = self
            .nas
            .iter()
            .position(|n| n.host == host && n.port == port);
        let i = match (edited, at) {
            (Some(e), Some(a)) if e != a => {
                let other = &self.nas[a].name;
                return Err(io::Error::new(
                    io::ErrorKind::AlreadyExists,
                    format!("{host}:{port} is already saved as {other}"),
                ));
            }
            (Some(e), _) => {
                self.nas[e].host = host;
                self.nas[e].port = port;
                e
            }
            (None, Some(a)) => a,
            (None, None) => {
                self.nas.push(SavedNas {
                    id: format!("nas-{}", ps5_dump_forge_flink::hex(&rand4())),
                    name: String::new(),
                    host,
                    port,
                    protocol,
                    user: String::new(),
                    password: String::new(),
                });
                self.nas.len() - 1
            }
        };
        let n = &mut self.nas[i];
        n.name = name;
        n.protocol = protocol;
        if let Some(u) = &req.user {
            n.user = u.trim().to_string();
        }
        if let Some(p) = &req.password {
            n.password = p.clone();
        }
        if protocol == Protocol::Nfs {
            n.user.clear();
            n.password.clear();
        }
        Ok(n.id.clone())
    }

    /// Saved NAS devices that moved to a new IP: an offline entry saved by IP address takes the
    /// address and port of the one host a search found with its protocol and a similar name
    /// (the same letters and digits, any case), when no entry is saved there yet. The ids moved.
    /// ponytail: a name is trusted as announced, so another device that takes an offline
    /// entry's name gets its saved login.
    pub fn migrate(&mut self, found: &[crate::mdns::Nas], online: &HashSet<String>) -> Vec<String> {
        let key = |name: &str| -> String {
            (name.chars().filter(|c| c.is_alphanumeric()))
                .flat_map(char::to_lowercase)
                .collect()
        };
        let mut moved = Vec::new();
        for i in 0..self.nas.len() {
            let n = &self.nas[i];
            let name = key(&n.name);
            if online.contains(&n.id) || name.is_empty() || n.host.parse::<IpAddr>().is_err() {
                continue;
            }
            let mut at: Vec<(String, u16)> = (found.iter())
                .filter(|f| f.service == n.protocol.service() && key(&f.name) == name)
                .map(|f| (f.address.to_ascii_lowercase(), f.port))
                .collect();
            at.sort();
            at.dedup();
            let [(host, port)] = at.as_slice() else {
                continue;
            };
            if self.nas.iter().any(|o| o.host == *host && o.port == *port) {
                continue;
            }
            let n = &mut self.nas[i];
            (n.host, n.port) = (host.clone(), *port);
            moved.push(n.id.clone());
        }
        moved
    }

    pub fn forget(&mut self, id: &str) -> bool {
        let n = self.nas.len();
        self.nas.retain(|x| x.id != id);
        self.nas.len() != n
    }
}

fn rand4() -> [u8; 4] {
    let mut b = [0u8; 4];
    let _ = getrandom::fill(&mut b);
    b
}

/// Online = a TCP connect to its port within `timeout`.
pub fn reachable(host: &str, port: u16, timeout: Duration) -> bool {
    let Ok(addrs) = (host, port).to_socket_addrs() else {
        return false;
    };
    addrs
        .into_iter()
        .any(|a| TcpStream::connect_timeout(&a, timeout).is_ok())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn save(host: &str, name: &str, user: Option<&str>, password: Option<&str>) -> NasSave {
        NasSave {
            id: None,
            name: name.into(),
            host: host.into(),
            port: None,
            protocol: None,
            user: user.map(Into::into),
            password: password.map(Into::into),
        }
    }

    #[test]
    fn an_ftp_server_is_saved_with_its_port() {
        let mut l = NasList::default();
        let req = NasSave {
            protocol: Some(Protocol::Ftp),
            ..save("10.0.0.9", "", None, None)
        };
        let id = l.upsert(&req).unwrap();
        assert_eq!(
            (l.nas[0].port, l.nas[0].protocol),
            (FTP_PORT, Protocol::Ftp)
        );
        // An edit that names no protocol keeps it; another port is another server.
        let edit = NasSave {
            id: Some(id),
            ..save("10.0.0.9:2121", "PS5 FTP", None, None)
        };
        l.upsert(&edit).unwrap();
        assert_eq!((l.nas[0].port, l.nas[0].protocol), (2121, Protocol::Ftp));
        // Saved again at its address without a protocol (not an edit): still the FTP entry.
        l.upsert(&save("10.0.0.9:2121", "", None, None)).unwrap();
        assert_eq!((l.nas.len(), l.nas[0].protocol), (1, Protocol::Ftp));
        // An old entry without the field reads as SMB.
        let old: SavedNas =
            serde_json::from_str(r#"{"id":"nas-1","name":"x","host":"h","port":445}"#).unwrap();
        assert_eq!(old.protocol, Protocol::Smb);
    }

    #[test]
    fn an_nfs_server_has_its_port_and_no_login() {
        let mut l = NasList::default();
        let req = NasSave {
            protocol: Some(Protocol::Nfs),
            ..save("10.0.0.7", "", Some("me"), Some("pw"))
        };
        let id = l.upsert(&req).unwrap();
        let n = &l.nas[0];
        assert_eq!((n.port, n.protocol), (NFS_PORT, Protocol::Nfs));
        assert_eq!((n.user.as_str(), n.password.as_str()), ("", ""));
        // An SMB entry switched to NFS drops its login; an edit naming no protocol keeps NFS.
        let smb = l
            .upsert(&save("10.0.0.8", "Box", Some("me"), Some("pw")))
            .unwrap();
        let switch = NasSave {
            id: Some(smb),
            protocol: Some(Protocol::Nfs),
            ..save("10.0.0.8:12049", "Box", None, None)
        };
        l.upsert(&switch).unwrap();
        let n = &l.nas[1];
        assert_eq!((n.port, n.protocol), (12049, Protocol::Nfs));
        assert_eq!((n.user.as_str(), n.password.as_str()), ("", ""));
        let edit = NasSave {
            id: Some(id),
            ..save("10.0.0.7", "Shelf", Some("x"), None)
        };
        l.upsert(&edit).unwrap();
        assert_eq!(
            (l.nas[0].protocol, l.nas[0].user.as_str()),
            (Protocol::Nfs, "")
        );
        // mDNS's service names are the protocols' spellings (Discover's Save sends them).
        for (_, service) in crate::mdns::SERVICES {
            let p = serde_json::from_value::<Protocol>(serde_json::json!(service));
            assert!(p.is_ok(), "{service}");
        }
        assert_eq!(serde_json::to_value(Protocol::Nfs).unwrap(), "nfs");
    }

    #[test]
    fn an_offline_nas_moves_to_the_one_host_with_a_similar_name() {
        let found = |name: &str, service: &str, address: &str, port| crate::mdns::Nas {
            name: name.into(),
            service: service.into(),
            address: address.into(),
            port,
        };
        let mut l = NasList::default();
        let smb = l
            .upsert(&save("10.0.0.5", "My NAS", None, Some("pw")))
            .unwrap();
        let ftp = l
            .upsert(&NasSave {
                protocol: Some(Protocol::Ftp),
                ..save("10.0.0.6", "Box", None, None)
            })
            .unwrap();
        let named = l.upsert(&save("nas.local", "Named", None, None)).unwrap();
        let finds = [
            found("my-nas", "smb", "10.0.0.50", 445),
            found("MY NAS", "smb", "10.0.0.50", 445),
            found("Box", "smb", "10.0.0.60", 445),
            found("Named", "smb", "10.0.0.70", 445),
        ];
        // Online entries stay; offline: the SMB one moves (its login kept), the FTP one finds
        // no FTP host by its name, the one saved by name is left to its name.
        assert!(l.migrate(&finds, &HashSet::from([smb.clone()])).is_empty());
        assert_eq!(l.migrate(&finds, &HashSet::new()), vec![smb.clone()]);
        let n = &l.nas[0];
        assert_eq!(
            (n.host.as_str(), n.port, n.password.as_str()),
            ("10.0.0.50", 445, "pw")
        );
        assert_eq!(l.nas[1].host, "10.0.0.6", "{ftp}");
        assert_eq!(l.nas[2].host, "nas.local", "{named}");
        // Two hosts with that name, or one already saved there: nothing moves.
        l.nas[0].host = "10.0.0.5".into();
        let two = [
            found("My NAS", "smb", "10.0.0.50", 445),
            found("My NAS", "smb", "10.0.0.51", 445),
        ];
        assert!(l.migrate(&two, &HashSet::new()).is_empty());
        l.upsert(&save("10.0.0.50", "Other", None, None)).unwrap();
        assert!(l.migrate(&finds, &HashSet::new()).is_empty());
    }

    #[test]
    fn parse_host_forms() {
        assert_eq!(
            parse_host("NAS.local", None, DEFAULT_PORT).unwrap(),
            ("nas.local".into(), 445)
        );
        assert_eq!(
            parse_host("10.0.0.2:1445", None, DEFAULT_PORT).unwrap(),
            ("10.0.0.2".into(), 1445)
        );
        assert_eq!(
            parse_host("[fe80::1]:446", None, DEFAULT_PORT).unwrap(),
            ("fe80::1".into(), 446)
        );
        assert_eq!(
            parse_host("10.0.0.2", Some(139), DEFAULT_PORT).unwrap(),
            ("10.0.0.2".into(), 139)
        );
        assert!(parse_host("", None, DEFAULT_PORT).is_err());
        assert!(parse_host("a:0", None, DEFAULT_PORT).is_err());
        assert!(parse_host("a/b", None, DEFAULT_PORT).is_err());
    }

    #[test]
    fn upsert_dedupes_and_keeps_credentials() {
        let mut l = NasList::default();
        let a = l
            .upsert(&save("10.0.0.2", "Box", Some("me"), Some("pw")))
            .unwrap();
        // Saved again from Discover (no credentials): the one entry, renamed, credentials kept.
        let b = l
            .upsert(&save("10.0.0.2:445", "My NAS", None, None))
            .unwrap();
        assert_eq!(a, b);
        assert_eq!(l.nas.len(), 1);
        assert_eq!(l.nas[0].name, "My NAS");
        assert_eq!(
            (l.nas[0].user.as_str(), l.nas[0].password.as_str()),
            ("me", "pw")
        );
        // Another port is another NAS; an empty password clears it.
        l.upsert(&save("10.0.0.2:1445", "", None, None)).unwrap();
        assert_eq!(l.nas.len(), 2);
        assert_eq!(l.nas[1].name, "10.0.0.2");
        l.upsert(&save("10.0.0.2", "My NAS", None, Some("")))
            .unwrap();
        assert!(l.nas[0].password.is_empty());
        assert!(!format!("{:?}", l.nas[0]).contains("pw"));
        // An edit by id moves the one entry to a new address; onto another's address: refused.
        let mut moved = save("10.0.0.9", "My NAS", None, None);
        moved.id = Some(a.clone());
        assert_eq!(l.upsert(&moved).unwrap(), a);
        assert_eq!((l.nas.len(), l.nas[0].host.as_str()), (2, "10.0.0.9"));
        moved.host = "10.0.0.2:1445".into();
        assert!(l.upsert(&moved).is_err());
        assert!(l.forget(&a));
        assert!(!l.forget(&a));
        assert_eq!(l.nas.len(), 1);
    }
}
