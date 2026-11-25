UPDATE siege_records
SET body_json = json_set(body_json, '$.data.service', 'SIEG ' || substr(json_extract(body_json, '$.data.service'), 7))
WHERE json_valid(body_json) AND json_extract(body_json, '$.data.service') IN
('SIEGE Fields','SIEGE Eco','SIEGE Hydrology','SIEGE Estate','SIEGE Address','SIEGE Experts');
