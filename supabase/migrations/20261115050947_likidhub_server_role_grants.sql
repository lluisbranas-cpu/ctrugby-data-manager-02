-- El servidor de Next usa exclusivamente la clave de servicio para las
-- operaciones administrativas. Estos permisos no se conceden a anon ni a
-- authenticated y no cambian las políticas RLS de usuarios.
grant select, insert, update, delete on table
  app_private.player_profiles,
  app_private.player_seasons,
  app_private.player_season_photos,
  app_private.operational_documents,
  app_private.operational_media,
  app_private.player_participations,
  app_private.player_featured_summary,
  app_private.player_news
to service_role;
