-- "Minimum No. of credits to be earned" for a department's curriculum book,
-- printed on the export's cover page and under the department heading in the
-- scheme table section. Nullable: the line is omitted entirely when unset.

ALTER TABLE departments ADD COLUMN min_credits INTEGER;
