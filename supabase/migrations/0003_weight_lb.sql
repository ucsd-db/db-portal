-- Team records weight in pounds. Column renamed (no data conversion — only test data existed).
alter table public.profiles rename column weight_kg to weight_lb;
alter table public.profiles alter column weight_lb type numeric(5,1);
