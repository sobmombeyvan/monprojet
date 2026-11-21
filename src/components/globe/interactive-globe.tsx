"use client";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { landDots, type GeoDestination } from "@/lib/geo";
import { cn } from "@/lib/utils";

type Origin = { city: string; lon: number; lat: number };
const R = Math.PI / 180;

/**
 * Globe interactif en canvas (aucune dépendance) :
 * rotation automatique, glisser pour tourner (souris et tactile), clic sur un point ou sur
 * une pastille pour centrer une destination et afficher sa fiche.
 */
export function InteractiveGlobe({
  destinations,
  origin,
  interactive = true,
  showChips = true,
  className,
}: {
  destinations: GeoDestination[];
  origin: Origin;
  interactive?: boolean;
  showChips?: boolean;
  className?: string;
}) {
  const t = useTranslations("home");
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const state = useRef({ lambda: 30, phi: 22, target: null as null | { lambda: number; phi: number }, selected: null as string | null, hover: null as string | null, drag: null as null | { x: number; y: number; lambda: number; phi: number; moved: boolean }, lastInteract: 0 });

  const focus = useCallback(
    (slug: string | null) => {
      const s = state.current;
      s.selected = slug;
      setSelected(slug);
      const d = destinations.find((x) => x.slug === slug);
      s.target = d ? { lambda: (d.lon + origin.lon) / 2, phi: Math.max(10, (d.lat + origin.lat) / 2) } : null;
      s.lastInteract = performance.now();
    },
    [destinations, origin],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dots = landDots();
    const s = state.current;
    let box = { width: 0, height: 0 };
    let markers: { slug: string; x: number; y: number }[] = [];
    let raf = 0;
    const t0 = performance.now();
    let prev = t0;

    const size = () => {
      const b = canvas.getBoundingClientRect();
      box = { width: Math.min(b.width, 900), height: Math.min(b.height, 900) };
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = box.width * dpr;
      canvas.height = box.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();
    const ro = new ResizeObserver(size);
    ro.observe(canvas);

    const geo = () => ({ cx: box.width / 2, cy: box.height / 2, rad: Math.min(box.width, box.height) * 0.43 });
    const proj = (lon: number, lat: number, alt = 1) => {
      const { cx, cy, rad } = geo();
      const l = lon * R, p = lat * R, dl = l - s.lambda * R, p0 = s.phi * R;
      const z = Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(dl);
      return {
        x: cx + rad * alt * Math.cos(p) * Math.sin(dl),
        y: cy - rad * alt * (Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(dl)),
        z,
      };
    };
    const toV = (lo: number, la: number) => [Math.cos(la * R) * Math.cos(lo * R), Math.cos(la * R) * Math.sin(lo * R), Math.sin(la * R)];
    const slerp = (a: { lon: number; lat: number }, b: { lon: number; lat: number }, k: number) => {
      const A = toV(a.lon, a.lat), B = toV(b.lon, b.lat);
      const d = Math.acos(Math.min(1, A[0] * B[0] + A[1] * B[1] + A[2] * B[2]));
      const s1 = Math.sin((1 - k) * d) / Math.sin(d), s2 = Math.sin(k * d) / Math.sin(d);
      const v = A.map((x, i) => s1 * x + s2 * B[i]);
      return [Math.atan2(v[1], v[0]) / R, Math.asin(v[2]) / R] as const;
    };
    const arcPt = (d: GeoDestination, k: number) => {
      const [lo, la] = slerp(origin, d, k);
      return { surf: proj(lo, la), p: proj(lo, la, 1 + 0.2 * Math.sin(Math.PI * k)) };
    };

    const pos = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] as const; };
    const hit = (x: number, y: number) => markers.find((m) => Math.hypot(m.x - x, m.y - y) < 16);
    const onDown = (e: PointerEvent) => { const [x, y] = pos(e); s.drag = { x, y, lambda: s.lambda, phi: s.phi, moved: false }; canvas.setPointerCapture(e.pointerId); };
    const onMove = (e: PointerEvent) => {
      const [x, y] = pos(e);
      if (s.drag) {
        const dx = x - s.drag.x, dy = y - s.drag.y;
        if (Math.hypot(dx, dy) > 4) { s.drag.moved = true; s.target = null; }
        if (s.drag.moved) { s.lambda = s.drag.lambda - dx * 0.35; s.phi = Math.max(-35, Math.min(60, s.drag.phi + dy * 0.25)); s.lastInteract = performance.now(); }
        return;
      }
      const m = hit(x, y);
      s.hover = m ? m.slug : null;
      canvas.style.cursor = m ? "pointer" : "grab";
    };
    const onUp = (e: PointerEvent) => { if (!s.drag) return; const [x, y] = pos(e); if (!s.drag.moved) { const m = hit(x, y); if (m) focus(m.slug); } s.drag = null; };
    const onLeave = () => { s.hover = null; };
    if (interactive) {
      canvas.addEventListener("pointerdown", onDown);
      canvas.addEventListener("pointermove", onMove);
      canvas.addEventListener("pointerup", onUp);
      canvas.addEventListener("pointercancel", onUp);
      canvas.addEventListener("pointerleave", onLeave);
    }

    const font = (w: number, px: number) => `${w} ${px}px var(--font-jakarta), Inter, sans-serif`;
    const frame = (now: number) => {
      const dt = Math.min(64, now - prev) / 1000; prev = now;
      const el = (now - t0) / 1000;
      if (s.target) { s.lambda += (s.target.lambda - s.lambda) * Math.min(1, dt * 3); s.phi += (s.target.phi - s.phi) * Math.min(1, dt * 3); }
      else if (!s.drag && !reduce && now - s.lastInteract > 2500 && !s.selected) s.lambda -= dt * 5;
      const { cx, cy, rad } = geo();
      ctx.clearRect(0, 0, box.width, box.height);
      const halo = ctx.createRadialGradient(cx, cy, rad * 0.95, cx, cy, rad * 1.18);
      halo.addColorStop(0, "rgba(37,175,165,.22)"); halo.addColorStop(1, "rgba(37,175,165,0)");
      ctx.beginPath(); ctx.arc(cx, cy, rad * 1.18, 0, Math.PI * 2); ctx.fillStyle = halo; ctx.fill();
      const g = ctx.createRadialGradient(cx - rad * 0.35, cy - rad * 0.45, rad * 0.1, cx, cy, rad);
      g.addColorStop(0, "#22507A"); g.addColorStop(1, "#0B1F33");
      ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.14)"; ctx.lineWidth = 1; ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,.05)";
      for (let la = -60; la <= 60; la += 30) { ctx.beginPath(); let st = false; for (let lo = -180; lo <= 180; lo += 4) { const p = proj(lo, la); if (p.z <= 0) { st = false; continue; } if (st) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); st = true; } ctx.stroke(); }
      for (let lo = -180; lo < 180; lo += 30) { ctx.beginPath(); let st = false; for (let la = -85; la <= 85; la += 4) { const p = proj(lo, la); if (p.z <= 0) { st = false; continue; } if (st) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); st = true; } ctx.stroke(); }
      for (const [lo, la] of dots) { const p = proj(lo, la); if (p.z <= 0) continue; ctx.fillStyle = `rgba(255,255,255,${0.1 + p.z * 0.5})`; ctx.beginPath(); ctx.arc(p.x, p.y, 0.7 + p.z * 0.6, 0, Math.PI * 2); ctx.fill(); }

      markers = [];
      destinations.forEach((d, i) => {
        const on = s.selected === d.slug || s.hover === d.slug;
        const dim = !!s.selected && !on;
        ctx.beginPath(); let st = false;
        for (let k = 0; k <= 60; k++) { const { surf, p } = arcPt(d, k / 60); if (surf.z < -0.1) { st = false; continue; } if (st) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); st = true; }
        ctx.strokeStyle = on ? "rgba(37,175,165,1)" : `rgba(37,175,165,${dim ? 0.18 : 0.55})`; ctx.lineWidth = on ? 2.2 : 1.1; ctx.stroke();
        if (!reduce) {
          const n = on ? 3 : 1;
          for (let j = 0; j < n; j++) { const k = (el * (on ? 0.35 : 0.2) + i * 0.13 + j / n) % 1; const { surf, p } = arcPt(d, k); if (surf.z > 0) { ctx.fillStyle = on ? "#fff" : "rgba(255,255,255,.7)"; ctx.beginPath(); ctx.arc(p.x, p.y, on ? 2.6 : 1.8, 0, Math.PI * 2); ctx.fill(); } }
        }
        const e = proj(d.lon, d.lat);
        if (e.z > 0.05) {
          markers.push({ slug: d.slug, x: e.x, y: e.y });
          if (on) { ctx.strokeStyle = `rgba(255,255,255,${0.6 - (el % 1.4) / 2.5})`; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(e.x, e.y, 5 + (el % 1.4) * 9, 0, Math.PI * 2); ctx.stroke(); }
          ctx.fillStyle = on ? "#25AFA5" : "#fff"; ctx.beginPath(); ctx.arc(e.x, e.y, on ? 4.5 : 3, 0, Math.PI * 2); ctx.fill();
          if (on) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; ctx.stroke(); }
          const label = d.city ?? d.name;
          if ((on || (!s.selected && i < 3)) && e.z > 0.2) {
            ctx.font = font(on ? 700 : 500, on ? 12.5 : 11);
            const tw = ctx.measureText(label).width;
            const tx = e.x < cx - rad * 0.2 ? e.x - 9 - tw : e.x + 9;
            ctx.fillStyle = `rgba(255,255,255,${on ? 1 : Math.min(0.85, e.z * 1.3)})`;
            ctx.fillText(label, tx, e.y - 7);
          }
        }
      });
      const o = proj(origin.lon, origin.lat);
      if (o.z > 0) {
        ctx.fillStyle = "rgba(37,175,165,.22)"; ctx.beginPath(); ctx.arc(o.x, o.y, 9 + Math.sin(el * 2) * 2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#25AFA5"; ctx.beginPath(); ctx.arc(o.x, o.y, 4, 0, Math.PI * 2); ctx.fill();
        ctx.font = font(700, 12); ctx.fillStyle = "#fff"; ctx.fillText(origin.city, o.x + 9, o.y + 16);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("pointerleave", onLeave);
    };
  }, [destinations, origin, interactive, focus]);

  const current = destinations.find((d) => d.slug === selected);

  return (
    <div className={className}>
      <div className="relative mx-auto aspect-square w-full max-w-[540px]">
        <canvas
          ref={canvasRef}
          className="block size-full"
          style={{ touchAction: "pan-y", cursor: interactive ? "grab" : "default" }}
          role="img"
          aria-label={t("globeFrom", { city: origin.city })}
        />
        {current && (
          <div className="sheet absolute inset-x-3 bottom-3 rounded-2xl bg-white/95 p-4 text-ink shadow-(--shadow-lift) backdrop-blur sm:inset-x-6 sm:bottom-6 sm:p-5" aria-live="polite">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-navy">{current.name}</p>
                <p className="text-xs text-muted">
                  {origin.city} → {current.city ?? current.name} · {t("expertsAvailable", { count: current.experts })}
                </p>
              </div>
              <button onClick={() => focus(null)} className="-m-1 rounded-full p-1 text-muted hover:text-navy" aria-label="×">
                <X className="size-4" />
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {current.opportunities.map((o) => (
                <span key={o} className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-semibold text-teal-600">{o}</span>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button asChild variant="outline" size="sm"><Link href={`/countries/${current.slug}`}>{t("seeDestination")}</Link></Button>
              <Button size="sm" onClick={() => router.push({ pathname: "/find-expert", query: { country: current.slug } })}>{t("seeExperts")}</Button>
            </div>
          </div>
        )}
      </div>
      {showChips && (
        <>
          <div className="mt-4 flex items-center justify-between gap-3 text-xs text-white/50">
            <span>{t("globeHint")}</span>
            <span className="hidden sm:inline">{t("globeFrom", { city: origin.city })}</span>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="group">
            {destinations.map((d) => (
              <button
                key={d.slug}
                type="button"
                aria-pressed={selected === d.slug}
                onClick={() => focus(selected === d.slug ? null : d.slug)}
                className={cn(
                  "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition",
                  selected === d.slug ? "border-white bg-white text-navy" : "border-white/20 text-white/80 hover:border-white hover:text-white",
                )}
              >
                {d.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
