/* SPDX-License-Identifier: GPL-3.0-or-later */
#include "ampr_pack.h"
#include <stdio.h>
#include <stdlib.h>
static unsigned char *runtime; static size_t runtime_size;
const unsigned char *ampr_pack_runtime_data(size_t *s) { if(s)*s=runtime_size; return runtime; }
const char *ampr_pack_runtime_sha256(void) { return "69e6c4d5e4f5fb83c9e01815db5861c4c75734acbf4595cafa50d4c218116d1a"; }
const char *ampr_pack_runtime_version(void) { return "0.4.2.1 PackedStdio"; }
int main(int argc,char **argv) {
  if(argc<5 || argc>7) return 2;
  FILE *f=fopen(argv[3],"rb"); if(!f)return 2;
  fseek(f,0,SEEK_END);runtime_size=ftell(f);rewind(f);runtime=malloc(runtime_size);
  if(!runtime || fread(runtime,1,runtime_size,f)!=runtime_size)return 2;
  fclose(f);
  ampr_pack_options_t o={.source_root=argv[1],.output_root=argv[2],.level=atoi(argv[4]),.workers=1,.block_shift=16,.auto_loose_large=1,.runtime=runtime,.runtime_size=runtime_size,.install_runtime_if_missing=1,.verify_loose_copies=1};
  if(argc>5 && argv[5][0]) o.profile_path=argv[5];
  if(argc>6 && argv[6][0]) o.learn_dir=argv[6];
  ampr_pack_stats_t stats={0};char err[1024]={0};int rc=ampr_pack_build(&o,&stats,err,sizeof(err));
  if(rc)fprintf(stderr,"%s\n",err);
  else printf("files=%llu logical=%llu stored=%llu\n",(unsigned long long)stats.files_packed,(unsigned long long)stats.logical_bytes,(unsigned long long)stats.stored_bytes);
  free(runtime);return rc?1:0;
}
