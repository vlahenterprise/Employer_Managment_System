UPDATE "OrgPosition"
SET "tier" = CASE
  WHEN lower("title") LIKE '%generalni direktor%' OR lower("title") LIKE '%ceo%' THEN 'DIRECTOR'::"OrgPositionTier"
  WHEN lower("title") LIKE '%menadžer%' OR lower("title") LIKE '%menadzer%' OR lower("title") LIKE '%manager%' OR lower("title") LIKE '%direktor%' OR lower("title") LIKE '%director%' OR lower("title") = 'coo' THEN 'MANAGER'::"OrgPositionTier"
  WHEN lower("title") LIKE '%supervizor%' OR lower("title") LIKE '%supervisor%' THEN 'SUPERVISOR'::"OrgPositionTier"
  WHEN lower("title") LIKE '%rukovodilac%' OR lower("title") LIKE '%lider%' OR lower("title") LIKE '%leader%' OR lower("title") LIKE '%team lead%' THEN 'LEAD'::"OrgPositionTier"
  ELSE 'STAFF'::"OrgPositionTier"
END;
