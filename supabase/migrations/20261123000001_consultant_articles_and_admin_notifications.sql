drop policy if exists "articles: consultant own write" on public.articles;
create policy "articles: consultant own write" on public.articles for all to authenticated
  using (
    author_id = auth.uid()
    and (
      public.has_role('consultant')
      or public.is_admin()
    )
  )
  with check (
    author_id = auth.uid()
    and (
      public.has_role('consultant')
      or public.is_admin()
    )
    and (
      public.is_admin()
      or status in ('draft', 'in_review')
    )
  );

drop policy if exists "sources: consultant own write" on public.article_sources;
create policy "sources: consultant own write" on public.article_sources for all to authenticated
  using (
    exists (
      select 1
      from public.articles a
      where a.id = article_id
        and a.author_id = auth.uid()
        and public.has_role('consultant')
    )
  )
  with check (
    exists (
      select 1
      from public.articles a
      where a.id = article_id
        and a.author_id = auth.uid()
        and public.has_role('consultant')
    )
  );
