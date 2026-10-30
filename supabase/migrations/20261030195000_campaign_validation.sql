alter table public.campaigns
  add constraint campaigns_name_length
    check (char_length(btrim(name)) between 2 and 160),
  add constraint campaigns_dates_ordered
    check (starts_at is null or ends_at is null or starts_at <= ends_at);

alter table public.activities
  add constraint activities_name_length
    check (char_length(btrim(name)) between 2 and 160),
  add constraint activities_description_length
    check (description is null or char_length(description) <= 2000);
