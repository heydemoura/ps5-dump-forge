/* SPDX-License-Identifier: GPL-3.0-or-later
 * Adapter for theghostonline's unmodified console profile/encoder code. */
#include "console/ampr_pack_internal.h"
#include "console/lz4.h"
#include "console/lz4hc.h"
#include <stdlib.h>
#include <string.h>
#include <stdio.h>

typedef struct console_spec {
  int selected, block_shift, store, hot, random, streaming;
  int mode_hc, level, acceleration, force_pack;
  uint64_t min_bytes;
  double min_ratio;
  uint64_t neutral_bytes;
  double neutral_ratio;
  uint32_t io_page;
  int group, lanes, assignment, dedup, scope, striped;
  uint64_t stripe_threshold;
  uint32_t stripe_blocks;
} console_spec;
typedef struct console_options {
  int enabled, hot;
  uint64_t min_file_size;
  uint32_t sample_blocks;
  uint64_t sample_bytes;
  double min_savings_ratio, max_raw_ratio;
  int has_runtime, auto_budget;
  uint64_t decoded_cache, physical_cache;
  uint32_t workers, reserve;
} console_options;
_Static_assert(sizeof(console_spec)==120,"console_spec ABI");
_Static_assert(sizeof(console_options)==80,"console_options ABI");

static int keep_on_disk(const char *path, uint64_t size) {
  static const char *patterns[]={
    "cache_ps5/pgc_*_dummy_file", "cache_ps5/playgo.pgm",
    "cache_ps5/load_menu_catalog.log", "cache_ps5/all_shaders.texmeshman",
    "cache_ps5/game.sprig.packman", "cache_ps5/game.sprig.texmeshman",
    "cache_ps5/pulse.sprig.texmeshman", "sounds/scream/_generated/buss_config.bus",
    "sounds/scream/_generated/distance_model.dml", "sounds/scream/_generated/group_mix.gmx"
  };
  if(!size) return 1;
  for(size_t i=0;i<sizeof(patterns)/sizeof(patterns[0]);i++) if(ap_fnmatch(patterns[i],path)) return 1;
  return 0;
}
int forge_console_policy(const char *const *paths,const uint64_t *sizes,size_t count,
                         const char *profile,const char *learn_dir,int level,int workers,
                         console_spec *out,console_options *opts,char *err,size_t err_size) {
  ap_config_t cfg; ap_scan_t scan={0}; int rc=-1;
  ap_config_init_defaults(&cfg);
  scan.files=calloc(count ? count : 1,sizeof(*scan.files));
  if(!scan.files) { snprintf(err,err_size,"console policy: out of memory"); goto done; }
  scan.file_count=count;
  for(size_t i=0;i<count;i++) {
    scan.files[i].rel=(char *)paths[i]; scan.files[i].size=sizes[i];
    const char *slash=paths[i];
    while((slash=strchr(slash,'/'))) {
      size_t n=(size_t)(slash-paths[i]);
      char *dir=malloc(n+1); if(!dir) goto done;
      memcpy(dir,paths[i],n); dir[n]=0;
      int added=ap_strlist_contains(&scan.dirs,dir) || ap_strlist_add(&scan.dirs,dir)==0;
      free(dir); if(!added) goto done; slash++;
    }
  }
  if(profile) {
    if(ap_config_load_toml(&cfg,profile,level,workers,err,err_size)) goto done;
  } else if(ap_config_build_universal(&cfg,&scan,level,16,workers,1,learn_dir,err,err_size)) goto done;
  if(ap_config_add_safety_exclusions(&cfg) || ap_config_finalize(&cfg,err,err_size)) goto done;
  memset(opts,0,sizeof(*opts));
  opts->enabled=cfg.auto_loose_large_files && !cfg.self_contained; opts->hot=cfg.auto_loose_hot_files;
  opts->min_file_size=cfg.auto_loose_min_file_size; opts->sample_blocks=cfg.auto_loose_sample_blocks;
  opts->sample_bytes=cfg.auto_loose_sample_bytes; opts->min_savings_ratio=cfg.auto_loose_min_savings_ratio;
  opts->max_raw_ratio=cfg.auto_loose_max_raw_ratio;
  opts->has_runtime=cfg.has_runtime; opts->auto_budget=cfg.runtime_auto_budget;
  opts->decoded_cache=cfg.rt_decoded_cache_bytes; opts->physical_cache=cfg.rt_physical_cache_bytes;
  opts->workers=cfg.rt_workers; opts->reserve=cfg.rt_latency_reserve_workers;
  for(size_t i=0;i<count;i++) {
    ap_rule_t scratch; const ap_rule_t *r=ap_config_select_rule(&cfg,paths[i],&scratch);
    console_spec *s=&out[i]; memset(s,0,sizeof(*s));
    if(!r || r->action==AP_ACTION_LOOSE || ap_glob_matches(paths[i],&cfg.force_loose) || keep_on_disk(paths[i],sizes[i])) continue;
    s->selected=1; s->block_shift=r->block_shift; s->store=r->action==AP_ACTION_STORE;
    s->hot=r->hot; int layout=ap_rule_resolved_layout(r);
    s->random=layout==AP_LAYOUT_RANDOM; s->streaming=layout==AP_LAYOUT_STREAMING;
    s->mode_hc=r->mode_hc; s->level=r->level; s->acceleration=r->acceleration; s->force_pack=r->force_pack;
    s->min_bytes=r->min_savings_bytes; s->min_ratio=r->min_savings_ratio;
    s->neutral_bytes=r->io_neutral_min_savings_bytes; s->neutral_ratio=r->io_neutral_min_savings_ratio;
    const ap_group_t *g=&cfg.groups[r->group];
    s->io_page=g->io_page_size ? g->io_page_size : cfg.io_page_size;
    s->group=r->group; s->lanes=g->pack_count; s->assignment=g->assignment;
    s->dedup=cfg.deduplicate && (!s->streaming || cfg.deduplicate_streaming);
    s->scope=cfg.dedupe_scope_group; s->striped=g->stripe_large_files;
    s->stripe_threshold=g->stripe_threshold; s->stripe_blocks=g->stripe_group_blocks;
  }
  rc=0;
done:
  if(rc && err_size && !err[0]) snprintf(err,err_size,"console policy allocation failed");
  ap_config_free(&cfg); ap_strlist_free(&scan.dirs); free(scan.files); return rc;
}
int forge_console_compress(const char *src,int size,char *dst,int cap,int hc,int level,int accel) {
  return hc ? LZ4_compress_HC(src,dst,size,cap,level) : LZ4_compress_fast(src,dst,size,cap,accel);
}
