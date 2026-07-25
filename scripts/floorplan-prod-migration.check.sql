-- 적용 후 검증 SELECT. 기대값은 각 줄 주석 참고.
-- (1) imageUrl 채워진 N7 층 수 = 7
SELECT COUNT(*) AS floors_with_image FROM BuildingFloor WHERE buildingId=(SELECT id FROM Building WHERE code='N7') AND imageUrl IS NOT NULL;
-- (2) width/height 둘 다 채워진 N7 층 수 = 7
SELECT COUNT(*) AS floors_with_size FROM BuildingFloor WHERE buildingId=(SELECT id FROM Building WHERE code='N7') AND width IS NOT NULL AND height IS NOT NULL;
-- (3) posX/posY 채워진 교수 수 = 50
SELECT COUNT(*) AS profs_placed FROM Professor WHERE posX IS NOT NULL AND posY IS NOT NULL;
-- (4) 좌표 범위 이탈(0~1 밖) 교수 = 0
SELECT COUNT(*) AS profs_out_of_range FROM Professor WHERE posX IS NOT NULL AND (posX<0 OR posX>1 OR posY<0 OR posY>1);
-- (5) 층별 imageUrl 확인 (7행, 모두 /floorplans/n7-N.png)
SELECT level, imageUrl, width, height FROM BuildingFloor WHERE buildingId=(SELECT id FROM Building WHERE code='N7') ORDER BY level;
