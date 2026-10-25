#!/usr/bin/env bash
# 배포 전에 실행: src/ 의 모든 모듈 주소에 내용 해시(?v=)를 붙인 import map 을 index.html 에 넣는다.
# 브라우저가 index.html 은 새것, 모듈은 캐시된 옛것을 섞어 쓰는 문제(버튼이 안 먹는 등)를 막는다.
cd "$(dirname "$0")/.."
# 건물 모델(glb)도 내용이 바뀌면 주소가 바뀌게
sed -i "s|assets/models/buildings.glb[^']*'|assets/models/buildings.glb?v=$(sha1sum assets/models/buildings.glb | cut -c1-8)'|" src/models.js
entries='"three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js", "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/"'
for f in $(find src -name '*.js' | sort); do
  entries="$entries, \"./$f\": \"./$f?v=$(sha1sum "$f" | cut -c1-8)\""
done
map="<script type=\"importmap\">{ \"imports\": { $entries } }</script>"
main="<script type=\"module\" src=\"src/main.js?v=$(sha1sum src/main.js | cut -c1-8)\"></script>"
sed -i "s|^<script type=\"importmap\">.*</script>\$|$map|; s|^<script type=\"module\" src=\"src/main.js[^\"]*\"></script>\$|$main|" index.html
echo "stamped $(find src -name '*.js' | wc -l) modules"
