-- One-time production migration-history reconciliation for tvvc-registration.
-- Safe to rerun after success. Run only after confirming the selected Turso
-- database and creating a current backup branch.
BEGIN IMMEDIATE;

CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
  id SERIAL PRIMARY KEY,
  hash text NOT NULL,
  created_at numeric
);

CREATE TEMP TABLE "__tvvc_expected_migrations" (
  hash text NOT NULL,
  created_at numeric NOT NULL PRIMARY KEY
);

INSERT INTO "__tvvc_expected_migrations" (hash, created_at) VALUES
  ('58812e1e9a013ee8cc14c345048c36a65ad10bf95e4293eaee16d3682937a8b6', 1784579436020),
  ('b69aff256d9a5561edcf70b9ed848733b9cf6648a0326e0065939f1e77959240', 1785429010117),
  ('11513284d9ac2a01b0003cb5eddb2495f8a1f4a80374c66e42bfd56084fd549d', 1785446867554),
  ('3dfb548211dfc86764f17710aebcbbf81194f2118db9327844af10dd4c6f0979', 1785448841508),
  ('65b89b4765ae123d223760ea227536b5a90b8ff35a29457e12a7e755f67e68b6', 1785863248920),
  ('0816506c5a3afe6bc66dc922b9cc360316329a6ec35d7d7df6047cffe13942b4', 1786027376189),
  ('3bdcaf184256f605b952154430cfb3c4319de4c249ff1d4dd9056efe18131b2c', 1786045296797),
  ('970abbb3f95c3ad830ae99a493e4dcea349b75611e5d35111dcc89b6cd7e93a4', 1786118400000),
  ('60017e5b711c3ef9a1bf6fca8221baffcb7d168e2caafc3bdfafeeabfad3ffbf', 1786138602540),
  ('8a2a8abf472db2c9b69833fe3534f6170306f80d7a4319cb84d2ae169a5c3374', 1786140810886),
  ('135c22deb57a6d8025df24a6f2c17f4587ed2a78dcca99e17d028f5ea1b5da6e', 1786141374259),
  ('f1efde51f1be63f8953c970e32bdd74b5e6f1ebe909bd0697455c359345f6b47', 1786143915540),
  ('be60983a854f8dd0bbd26b085c36f4174ca04f131f1ade67b0a3f89baef5a182', 1786209661083);

CREATE TEMP TABLE "__tvvc_baseline_guard" (
  ok integer NOT NULL CHECK (ok = 1)
);

INSERT INTO "__tvvc_baseline_guard" (ok)
SELECT CASE WHEN
  (SELECT count(*) FROM sqlite_master WHERE type = 'table' AND name LIKE 'club_%') = 19
  AND (SELECT count(*) FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'club_%') = 27
  AND (SELECT count(*) FROM sqlite_master WHERE type = 'index' AND name LIKE 'club_%') = 74
  AND (SELECT count(*) FROM "__drizzle_migrations") IN (0, 13)
  AND NOT EXISTS (
    SELECT 1
    FROM "__drizzle_migrations" actual
    LEFT JOIN "__tvvc_expected_migrations" expected
      ON expected.created_at = actual.created_at AND expected.hash = actual.hash
    WHERE expected.created_at IS NULL
  )
  THEN 1 ELSE 0 END;

INSERT INTO "__drizzle_migrations" (hash, created_at)
SELECT expected.hash, expected.created_at
FROM "__tvvc_expected_migrations" expected
WHERE NOT EXISTS (
  SELECT 1 FROM "__drizzle_migrations" actual
  WHERE actual.created_at = expected.created_at
);

INSERT INTO "__tvvc_baseline_guard" (ok)
SELECT CASE WHEN
  (SELECT count(*) FROM "__drizzle_migrations") = 13
  AND NOT EXISTS (
    SELECT 1
    FROM "__tvvc_expected_migrations" expected
    LEFT JOIN "__drizzle_migrations" actual
      ON actual.created_at = expected.created_at AND actual.hash = expected.hash
    WHERE actual.created_at IS NULL
  )
  THEN 1 ELSE 0 END;

DROP TABLE "__tvvc_baseline_guard";
DROP TABLE "__tvvc_expected_migrations";
COMMIT;
