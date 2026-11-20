export function HeroVisual() {
  return (
    <div className="relative mx-auto mt-8 h-56 w-full max-w-sm">
      <div
        className="absolute left-4 top-6 w-36 animate-floaty sm:left-8 sm:w-40"
        style={{ animationDelay: "0s" }}
      >
        <div className="polaroid -rotate-6">
          <div
            className="flex aspect-square items-center justify-center text-4xl font-bold"
            style={{ background: "linear-gradient(135deg,#c8f542,#7be0ff)" }}
          >
            01
          </div>
          <p className="mt-2 text-center text-[11px] font-semibold tracking-wide">миссия</p>
        </div>
      </div>
      <div
        className="absolute right-2 top-0 w-40 animate-floaty sm:right-6 sm:w-44"
        style={{ animationDelay: "-1.8s" }}
      >
        <div className="polaroid rotate-3">
          <div
            className="flex aspect-square items-center justify-center"
            style={{ background: "linear-gradient(160deg,#ff5a3d,#172235)" }}
          >
            <span className="display text-5xl text-white">SNAP</span>
          </div>
          <p className="mt-2 text-center text-[11px] font-semibold tracking-wide">на модерации</p>
        </div>
      </div>
      <div
        className="absolute bottom-0 left-1/2 h-16 w-16 -translate-x-1/2 animate-shutter rounded-full border-2"
        style={{ borderColor: "var(--lime)", boxShadow: "0 0 30px rgba(200,245,66,0.35)" }}
      />
    </div>
  );
}
