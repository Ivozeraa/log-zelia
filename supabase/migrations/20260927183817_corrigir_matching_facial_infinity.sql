create or replace function private.human_face_similarity(
  a double precision[],
  b double precision[]
)
returns double precision
language plpgsql
immutable
set search_path = ''
as $function$
declare
  v_distance double precision;
  v_root double precision;
  v_min constant double precision := 0.2;
  v_max constant double precision := 0.8;
  v_norm double precision;
begin
  v_distance := private.human_face_distance(a, b);

  if v_distance = 0 then
    return 1;
  end if;

  if v_distance = 'Infinity'::double precision
     or v_distance = '-Infinity'::double precision
     or v_distance <> v_distance then
    return 0;
  end if;

  v_root := sqrt(v_distance);
  v_norm := (1 - (v_root / 100) - v_min) / (v_max - v_min);

  return round(
    greatest(least(v_norm, 1), 0)::numeric,
    2
  )::double precision;
end;
$function$;