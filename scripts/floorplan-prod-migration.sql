-- 평면도 프로덕션 반영 마이그레이션 (Turso/libSQL). UPDATE 전용, id 비의존.
-- 생성: scripts/gen (dev.db 기준). 자연키 = Building.code='N7' + level, Professor.name.
-- BuildingFloor 7행, Professor 50행.

-- ── BuildingFloor: imageUrl/width/height (7층) ──
UPDATE BuildingFloor SET imageUrl='/floorplans/n7-1.png', width=1933, height=1437 WHERE buildingId=(SELECT id FROM Building WHERE code='N7') AND level=1;
UPDATE BuildingFloor SET imageUrl='/floorplans/n7-2.png', width=2200, height=1603 WHERE buildingId=(SELECT id FROM Building WHERE code='N7') AND level=2;
UPDATE BuildingFloor SET imageUrl='/floorplans/n7-3.png', width=1934, height=1419 WHERE buildingId=(SELECT id FROM Building WHERE code='N7') AND level=3;
UPDATE BuildingFloor SET imageUrl='/floorplans/n7-4.png', width=2055, height=436 WHERE buildingId=(SELECT id FROM Building WHERE code='N7') AND level=4;
UPDATE BuildingFloor SET imageUrl='/floorplans/n7-5.png', width=1856, height=377 WHERE buildingId=(SELECT id FROM Building WHERE code='N7') AND level=5;
UPDATE BuildingFloor SET imageUrl='/floorplans/n7-6.png', width=1523, height=410 WHERE buildingId=(SELECT id FROM Building WHERE code='N7') AND level=6;
UPDATE BuildingFloor SET imageUrl='/floorplans/n7-7.png', width=1527, height=362 WHERE buildingId=(SELECT id FROM Building WHERE code='N7') AND level=7;

-- ── Professor: posX/posY 정규화 좌표 (50명, name 자연키) ──
UPDATE Professor SET posX=0.22256, posY=0.67206 WHERE name='강준상';
UPDATE Professor SET posX=0.80262, posY=0.62043 WHERE name='경기욱';
UPDATE Professor SET posX=0.89255, posY=0.13429 WHERE name='공경철';
UPDATE Professor SET posX=0.89834, posY=0.44186 WHERE name='구승범';
UPDATE Professor SET posX=0.32484, posY=0.62635 WHERE name='김경수';
UPDATE Professor SET posX=0.16315, posY=0.65088 WHERE name='김남일';
UPDATE Professor SET posX=0.14145, posY=0.65165 WHERE name='김대겸';
UPDATE Professor SET posX=0.83548, posY=0.4149 WHERE name='김산하';
UPDATE Professor SET posX=0.67026, posY=0.62635 WHERE name='김성수';
UPDATE Professor SET posX=0.35145, posY=0.66953 WHERE name='김성용';
UPDATE Professor SET posX=0.18458, posY=0.65321 WHERE name='김성진';
UPDATE Professor SET posX=0.25585, posY=0.66995 WHERE name='김영진';
UPDATE Professor SET posX=0.73703, posY=0.44289 WHERE name='김정';
UPDATE Professor SET posX=0.62472, posY=0.62635 WHERE name='김정원';
UPDATE Professor SET posX=0.71054, posY=0.62635 WHERE name='김택수';
UPDATE Professor SET posX=0.30825, posY=0.66949 WHERE name='김현진';
UPDATE Professor SET posX=0.20597, posY=0.65514 WHERE name='김형수';
UPDATE Professor SET posX=0.29258, posY=0.65592 WHERE name='남영석';
UPDATE Professor SET posX=0.80261, posY=0.41393 WHERE name='노민균';
UPDATE Professor SET posX=0.83445, posY=0.44083 WHERE name='박수경';
UPDATE Professor SET posX=0.15981, posY=0.63976 WHERE name='박용화';
UPDATE Professor SET posX=0.73612, posY=0.66952 WHERE name='박인규';
UPDATE Professor SET posX=0.65414, posY=0.66949 WHERE name='박해원';
UPDATE Professor SET posX=0.80126, posY=0.44083 WHERE name='박형순';
UPDATE Professor SET posX=0.36736, posY=0.62635 WHERE name='배중면';
UPDATE Professor SET posX=0.22759, posY=0.65514 WHERE name='배충식';
UPDATE Professor SET posX=0.8666, posY=0.44699 WHERE name='신현정';
UPDATE Professor SET posX=0.13533, posY=0.66995 WHERE name='심기동';
UPDATE Professor SET posX=0.69448, posY=0.66952 WHERE name='안송이';
UPDATE Professor SET posX=0.58182, posY=0.62635 WHERE name='오왕열';
UPDATE Professor SET posX=0.5655, posY=0.66949 WHERE name='오현동';
UPDATE Professor SET posX=0.86087, posY=0.13429 WHERE name='유승화';
UPDATE Professor SET posX=0.82826, posY=0.13429 WHERE name='유홍기';
UPDATE Professor SET posX=0.78741, posY=0.66428 WHERE name='윤국진';
UPDATE Professor SET posX=0.19417, posY=0.62687 WHERE name='윤용진';
UPDATE Professor SET posX=0.77118, posY=0.41607 WHERE name='윤정환';
UPDATE Professor SET posX=0.48191, posY=0.66949 WHERE name='이강택';
UPDATE Professor SET posX=0.76838, posY=0.44083 WHERE name='이두용';
UPDATE Professor SET posX=0.39905, posY=0.65788 WHERE name='이봉재';
UPDATE Professor SET posX=0.27655, posY=0.62687 WHERE name='이승섭';
UPDATE Professor SET posX=0.74412, posY=0.66952 WHERE name='이승철';
UPDATE Professor SET posX=0.44894, posY=0.62635 WHERE name='이익진';
UPDATE Professor SET posX=0.24905, posY=0.65477 WHERE name='이정철';
UPDATE Professor SET posX=0.79752, posY=0.13429 WHERE name='전성윤';
UPDATE Professor SET posX=0.07172, posY=0.6384 WHERE name='전원주';
UPDATE Professor SET posX=0.098, posY=0.65206 WHERE name='정상권';
UPDATE Professor SET posX=0.07641, posY=0.65168 WHERE name='조연우';
UPDATE Professor SET posX=0.40415, posY=0.62635 WHERE name='조한솔';
UPDATE Professor SET posX=0.3142, posY=0.65514 WHERE name='최세범';
UPDATE Professor SET posX=0.26385, posY=0.66995 WHERE name='한지훈';
