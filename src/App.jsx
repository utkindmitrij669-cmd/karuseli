import { useState, useRef, useCallback, useEffect } from "react";

/* ────────── CONFIG ────────── */
const FONTS = {
  modern: { name: "Outfit", url: "https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap" },
  elegant: { name: "Playfair Display", url: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700;800;900&display=swap" },
  bold: { name: "Space Grotesk", url: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap" },
  creative: { name: "Sora", url: "https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&display=swap" },
};
const BODY_FONT = { name: "DM Sans", url: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap" };

const THEMES = {
  minimal: { label: "Минимализм", bg: "#FAFAF9", text: "#1A1A1A", accent: "#E85D3A", secondary: "#F5F0EB", isDark: false },
  dark:    { label: "Тёмный",     bg: "#0F0F0F", text: "#FFFFFF", accent: "#6EE7B7", secondary: "#1A1A2E", isDark: true },
  ocean:   { label: "Океан",      bg: "#0C1B33", text: "#FFFFFF", accent: "#00D4FF", secondary: "#142850", isDark: true },
  sunset:  { label: "Закат",      bg: "#1A0A2E", text: "#FFFFFF", accent: "#FF6B6B", secondary: "#2D1B4E", isDark: true },
  nature:  { label: "Природа",    bg: "#F7F5F0", text: "#2D3B2D", accent: "#4A7C59", secondary: "#E8E4DB", isDark: false },
  neon:    { label: "Неон",       bg: "#0A0A0A", text: "#FFFFFF", accent: "#E040FB", secondary: "#1A1A2E", isDark: true },
};

const SLIDE_TYPES = { cover: "Обложка", content: "Контент", quote: "Цитата", list: "Список", cta: "Призыв" };
const BG_MODES = { color: "Цвет", overlay: "Фото + затемнение", split: "Сплит-лейаут" };

const DEFAULT_SYSTEM_PROMPT = `Ты — профессиональный копирайтер и контент-стратег, специализирующийся на создании Instagram каруселей для экспертов.

Твоя задача — превратить идею или надиктованный текст эксперта в структурированную карусель из 5-8 слайдов.

Правила:
- Первый слайд — цепляющая обложка (type: "cover") с интригующим заголовком
- Последний слайд — призыв к действию (type: "cta")  
- Между ними — полезный контент (type: "content", "list", "quote")
- Пиши кратко — каждый слайд должен читаться за 3-5 секунд
- Используй простой разговорный язык
- Для списков используй • как маркер
- Эмодзи — умеренно, 1-2 на слайд максимум
- Заголовки — короткие, ёмкие, цепляющие

Отвечай ТОЛЬКО валидным JSON массивом. Формат каждого слайда:
{"type": "cover|content|quote|list|cta", "title": "...", "subtitle": "..." (только для cover), "body": "..." (для всех кроме cover)}`;

const DEFAULT_SLIDES = [
  { type: "cover", title: "5 привычек успешных людей", subtitle: "Что делают те, кто добивается целей", bgMode: "color" },
  { type: "content", title: "1. Ранний подъём", body: "Успешные люди встают рано и используют утро для самых важных задач. Это время тишины и фокуса.", bgMode: "color" },
  { type: "content", title: "2. Планирование дня", body: "Каждый вечер они планируют следующий день. Чёткий план = чёткие результаты.", bgMode: "color" },
  { type: "list", title: "3. Постоянное обучение", body: "• Читают минимум 30 минут\n• Слушают подкасты\n• Проходят курсы\n• Учатся у менторов", bgMode: "color" },
  { type: "quote", title: '"Дисциплина — это мост между целями и достижениями"', body: "— Джим Рон", bgMode: "color" },
  { type: "cta", title: "Понравилось?", body: "Сохрани 💾 Поделись 📤\nПодпишись на @username", bgMode: "color" },
];

/* ────────── HELPERS ────────── */
function wrapText(ctx, text, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? line + " " + word : word;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = word; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function LoadFonts() {
  useEffect(() => {
    const links = [BODY_FONT, ...Object.values(FONTS)].map(f => {
      const l = document.createElement("link"); l.href = f.url; l.rel = "stylesheet"; document.head.appendChild(l); return l;
    });
    return () => links.forEach(l => l.remove());
  }, []);
  return null;
}

/* ────────── VOICE BUTTON ────────── */
function VoiceButton({ onResult, disabled }) {
  const [listening, setListening] = useState(false);
  const recRef = useRef(null);

  const toggle = () => {
    if (listening) { recRef.current?.stop(); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Ваш браузер не поддерживает голосовой ввод. Попробуйте Chrome."); return; }
    const rec = new SR();
    rec.lang = "ru-RU"; rec.continuous = true; rec.interimResults = true;
    let finalText = "";
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript + " ";
        else interim += e.results[i][0].transcript;
      }
      onResult(finalText + interim, false);
    };
    rec.onend = () => { setListening(false); onResult(finalText.trim(), true); };
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  };

  return (
    <button
      onClick={toggle}
      disabled={disabled}
      title={listening ? "Остановить запись" : "Надиктовать голосом"}
      style={{
        width: 44, height: 44, borderRadius: 12,
        border: listening ? "2px solid #EF4444" : "1px solid #E5E5E5",
        background: listening ? "#FEF2F2" : "#F9FAFB",
        cursor: disabled ? "default" : "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 20, transition: "all .2s",
        animation: listening ? "pulse 1.5s infinite" : "none",
        flexShrink: 0,
      }}
    >
      {listening ? "⏹" : "🎤"}
    </button>
  );
}

/* ────────── SLIDE PREVIEW (DOM) ────────── */
function SlidePreview({ slide, theme, font, format, logo, expertName, slideIndex, totalSlides, customAccent }) {
  const t = { ...(THEMES[theme] || THEMES.minimal) };
  if (customAccent) t.accent = customAccent;
  const f = FONTS[font] || FONTS.modern;
  const isVert = format === "vertical";
  const w = 1080, h = isVert ? 1350 : 1080;
  const scale = isVert ? 0.22 : 0.25;
  const hasBgImg = slide.bgImage && (slide.bgMode === "overlay" || slide.bgMode === "split");
  const isSplit = slide.bgMode === "split" && slide.bgImage;

  const base = {
    width: w, height: h,
    fontFamily: `'${BODY_FONT.name}', sans-serif`,
    position: "relative", overflow: "hidden",
    display: "flex", boxSizing: "border-box",
    transform: `scale(${scale})`, transformOrigin: "top left",
  };

  if (isSplit) {
    return (
      <div style={{ ...base, flexDirection: "row" }}>
        <div style={{ width: "45%", height: "100%", background: `url(${slide.bgImage}) center/cover no-repeat` }} />
        <div style={{
          width: "55%", height: "100%", background: t.bg, color: t.text,
          display: "flex", flexDirection: "column", justifyContent: "center", padding: "60px 70px",
          position: "relative",
        }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 6, background: `linear-gradient(90deg, ${t.accent}, ${t.accent}88)` }} />
          {slide.type === "cover" && slide.subtitle && (
            <div style={{ fontSize: 24, textTransform: "uppercase", letterSpacing: "0.12em", color: t.accent, marginBottom: 18, fontWeight: 600 }}>{slide.subtitle}</div>
          )}
          <div style={{ fontFamily: `'${f.name}', sans-serif`, fontWeight: 800, fontSize: slide.type === "cover" ? 58 : 46, lineHeight: 1.15, marginBottom: 24, letterSpacing: "-0.02em" }}>{slide.title}</div>
          {slide.body && <div style={{ fontSize: 32, lineHeight: 1.55, color: `${t.text}CC`, whiteSpace: "pre-line" }}>{slide.body}</div>}
          <div style={{ position: "absolute", bottom: 36, left: 70, display: "flex", alignItems: "center", gap: 14 }}>
            {logo && <img src={logo} alt="" style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover" }} />}
            {expertName && <span style={{ fontSize: 24, color: `${t.text}88`, fontWeight: 500 }}>{expertName}</span>}
          </div>
          <div style={{ position: "absolute", bottom: 36, right: 70, fontSize: 26, color: `${t.text}55`, fontFamily: `'${f.name}'`, fontWeight: 500 }}>{slideIndex + 1}/{totalSlides}</div>
        </div>
      </div>
    );
  }

  const bgStyle = hasBgImg
    ? { background: `linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.55)), url(${slide.bgImage}) center/cover no-repeat`, color: "#FFFFFF" }
    : { background: slide.type === "cover" ? `linear-gradient(135deg, ${t.bg} 0%, ${t.secondary} 100%)` : t.bg, color: t.text };

  const textColor = hasBgImg ? "#FFFFFF" : t.text;

  return (
    <div style={{ ...base, flexDirection: "column", justifyContent: "center", padding: 80, ...bgStyle }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: slide.type === "cover" ? 8 : 6, background: `linear-gradient(90deg, ${t.accent}, ${t.accent}88)` }} />
      {slide.type === "cover" && !hasBgImg && (
        <>
          <div style={{ position: "absolute", width: 400, height: 400, borderRadius: "50%", background: `${t.accent}08`, border: `2px solid ${t.accent}15`, top: -120, right: -120 }} />
          <div style={{ position: "absolute", width: 500, height: 500, borderRadius: "50%", background: `${t.accent}08`, border: `2px solid ${t.accent}15`, bottom: -200, left: -100 }} />
        </>
      )}
      {slide.type === "quote" && (
        <div style={{ position: "absolute", top: 60, left: 60, fontSize: 200, fontFamily: `'${f.name}', serif`, color: hasBgImg ? "rgba(255,255,255,0.15)" : `${t.accent}25`, lineHeight: 1, fontWeight: 900 }}>"</div>
      )}
      <div style={{ position: "relative", zIndex: 2, flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        {slide.type === "cover" && slide.subtitle && (
          <div style={{ fontSize: 28, textTransform: "uppercase", letterSpacing: "0.15em", color: hasBgImg ? "rgba(255,255,255,0.85)" : t.accent, marginBottom: 24, fontWeight: 600 }}>{slide.subtitle}</div>
        )}
        <div style={{
          fontFamily: `'${f.name}', sans-serif`, fontWeight: 800,
          fontSize: slide.type === "cover" ? 72 : slide.type === "quote" ? 56 : 54,
          lineHeight: 1.15, marginBottom: 32, letterSpacing: "-0.02em", color: textColor,
          textShadow: hasBgImg ? "0 2px 12px rgba(0,0,0,0.3)" : "none",
        }}>
          {slide.title}
        </div>
        {slide.body && (
          <div style={{ fontSize: 36, lineHeight: 1.6, color: hasBgImg ? "rgba(255,255,255,0.88)" : `${textColor}CC`, fontWeight: 400, whiteSpace: "pre-line",
            textShadow: hasBgImg ? "0 1px 8px rgba(0,0,0,0.25)" : "none",
          }}>{slide.body}</div>
        )}
        {slide.type === "cta" && (
          <div style={{
            marginTop: 40, display: "inline-flex", alignSelf: "flex-start",
            padding: "24px 60px", background: t.accent,
            color: (t.isDark || hasBgImg) ? "#0F0F0F" : "#FFFFFF",
            borderRadius: 60, fontSize: 32, fontWeight: 700, fontFamily: `'${f.name}', sans-serif`,
          }}>Подписаться →</div>
        )}
      </div>
      <div style={{ position: "absolute", bottom: 36, left: 80, display: "flex", alignItems: "center", gap: 16 }}>
        {logo && <img src={logo} alt="" style={{ width: 52, height: 52, borderRadius: "50%", objectFit: "cover" }} />}
        {expertName && <span style={{ fontSize: 26, color: hasBgImg ? "rgba(255,255,255,0.65)" : `${textColor}88`, fontWeight: 500 }}>{expertName}</span>}
      </div>
      <div style={{ position: "absolute", bottom: 40, right: 80, fontSize: 28, color: hasBgImg ? "rgba(255,255,255,0.45)" : `${textColor}55`, fontFamily: `'${f.name}'`, fontWeight: 500 }}>{slideIndex + 1}/{totalSlides}</div>
    </div>
  );
}

/* ────────── SLIDE EDITOR ────────── */
function SlideEditor({ slide, index, onChange, onRemove, canRemove }) {
  const fileRef = useRef(null);
  const handleBgUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = (ev) => onChange({ ...slide, bgImage: ev.target.result });
    r.readAsDataURL(file);
  };

  const inputStyle = {
    padding: "10px 14px", borderRadius: 10, border: "1px solid #E5E5E5",
    fontSize: 14, fontFamily: "'DM Sans', sans-serif", width: "100%", boxSizing: "border-box",
  };

  return (
    <div style={{ background: "#FFF", border: "1px solid #E5E5E5", borderRadius: 16, padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Слайд {index + 1}</span>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <select value={slide.type} onChange={(e) => onChange({ ...slide, type: e.target.value })}
            style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid #E5E5E5", fontSize: 12, background: "#F9FAFB", cursor: "pointer" }}>
            {Object.entries(SLIDE_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          {canRemove && <button onClick={onRemove} style={{ background: "none", border: "none", color: "#EF4444", cursor: "pointer", fontSize: 16, padding: 4 }}>✕</button>}
        </div>
      </div>

      <input value={slide.title || ""} onChange={(e) => onChange({ ...slide, title: e.target.value })} placeholder="Заголовок" style={{ ...inputStyle, fontWeight: 600 }} />

      {slide.type === "cover" && (
        <input value={slide.subtitle || ""} onChange={(e) => onChange({ ...slide, subtitle: e.target.value })} placeholder="Подзаголовок" style={inputStyle} />
      )}
      {slide.type !== "cover" && (
        <textarea value={slide.body || ""} onChange={(e) => onChange({ ...slide, body: e.target.value })} placeholder="Текст слайда" rows={2} style={{ ...inputStyle, resize: "vertical" }} />
      )}

      {/* Background mode */}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {Object.entries(BG_MODES).map(([k, v]) => (
          <button key={k} onClick={() => onChange({ ...slide, bgMode: k })}
            style={{
              padding: "5px 12px", borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: "pointer",
              border: (slide.bgMode || "color") === k ? "2px solid #E85D3A" : "1px solid #E5E5E5",
              background: (slide.bgMode || "color") === k ? "#FEF3F0" : "#FFF",
              fontFamily: "'DM Sans', sans-serif",
            }}>
            {v}
          </button>
        ))}
      </div>

      {(slide.bgMode === "overlay" || slide.bgMode === "split") && (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {slide.bgImage && <img src={slide.bgImage} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover" }} />}
          <button onClick={() => fileRef.current?.click()}
            style={{ padding: "7px 14px", borderRadius: 8, border: "1px dashed #CCC", background: "#FAFAFA", fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans'" }}>
            {slide.bgImage ? "Заменить" : "Загрузить"} фото
          </button>
          {slide.bgImage && <button onClick={() => onChange({ ...slide, bgImage: null })} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14 }}>✕</button>}
          <input ref={fileRef} type="file" accept="image/*" onChange={handleBgUpload} style={{ display: "none" }} />
        </div>
      )}
    </div>
  );
}

/* ────────── MAIN APP ────────── */
export default function App() {
  const [slides, setSlides] = useState(DEFAULT_SLIDES);
  const [theme, setTheme] = useState("minimal");
  const [font, setFont] = useState("modern");
  const [format, setFormat] = useState("vertical");
  const [logo, setLogo] = useState(null);
  const [expertName, setExpertName] = useState("");
  const [activeSlide, setActiveSlide] = useState(0);
  const [apiKey, setApiKey] = useState("");
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [userPrompt, setUserPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [tab, setTab] = useState("ai");
  const [customAccent, setCustomAccent] = useState("");
  const [exportingAll, setExportingAll] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [dalleLoading, setDalleLoading] = useState(null);

  const fileRef = useRef(null);

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const r = new FileReader(); r.onload = (ev) => setLogo(ev.target.result); r.readAsDataURL(file);
  };

  const currentTheme = (() => {
    const base = THEMES[theme] || THEMES.minimal;
    return customAccent ? { ...base, accent: customAccent } : base;
  })();

  /* ── AI Generate carousel ── */
  const generateWithAI = async () => {
    if (!apiKey || !userPrompt) return;
    setAiLoading(true);
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.8,
        }),
      });
      const data = await res.json();
      if (data.error) { alert("OpenAI ошибка: " + data.error.message); setAiLoading(false); return; }
      const text = data.choices?.[0]?.message?.content || "";
      const cleaned = text.replace(/```json\n?/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed) && parsed.length > 0) {
        setSlides(parsed.map(s => ({ ...s, bgMode: s.bgMode || "color" })));
        setActiveSlide(0);
      }
    } catch (err) { alert("Ошибка: " + err.message); }
    setAiLoading(false);
  };

  /* ── DALL-E generate bg ── */
  const generateBgImage = async (index) => {
    if (!apiKey) { alert("Введите OpenAI API Key"); return; }
    const slide = slides[index];
    setDalleLoading(index);
    try {
      const promptText = `Create a professional, high-quality background photo for an Instagram slide about: "${slide.title}". Style: modern, clean, suitable as background with text overlay. No text in image. Subtle and aesthetic.`;
      const res = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: "dall-e-3", prompt: promptText, n: 1, size: "1024x1024", quality: "standard" }),
      });
      const data = await res.json();
      if (data.error) { alert("DALL-E ошибка: " + data.error.message); setDalleLoading(null); return; }
      const url = data.data?.[0]?.url;
      if (url) updateSlide(index, { ...slide, bgImage: url, bgMode: slide.bgMode === "color" ? "overlay" : slide.bgMode });
    } catch (err) { alert("Ошибка генерации: " + err.message); }
    setDalleLoading(null);
  };

  /* ── Export slide as PNG via canvas ── */
  const exportSlide = useCallback(async (index) => {
    const slide = slides[index];
    const t = { ...(THEMES[theme] || THEMES.minimal) };
    if (customAccent) t.accent = customAccent;
    const f = FONTS[font] || FONTS.modern;
    const w = 1080, h = format === "vertical" ? 1350 : 1080;
    const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    const hasBgImg = slide.bgImage && (slide.bgMode === "overlay" || slide.bgMode === "split");
    const isSplit = slide.bgMode === "split" && slide.bgImage;

    const drawContent = (textColor, padX, startY, contentW) => {
      let y = startY;
      if (slide.type === "cover" && slide.subtitle) {
        ctx.font = `600 28px "${BODY_FONT.name}", sans-serif`;
        ctx.fillStyle = hasBgImg && !isSplit ? "rgba(255,255,255,0.85)" : t.accent;
        ctx.fillText(slide.subtitle.toUpperCase(), padX, y); y += 50;
      }
      const tSize = slide.type === "cover" ? (isSplit ? 58 : 72) : (isSplit ? 46 : 54);
      ctx.font = `800 ${tSize}px "${f.name}", sans-serif`;
      ctx.fillStyle = textColor;
      wrapText(ctx, slide.title || "", contentW, tSize).forEach(ln => { y += tSize * 1.15; ctx.fillText(ln, padX, y); });
      y += 40;
      if (slide.body) {
        ctx.font = `400 ${isSplit ? 30 : 36}px "${BODY_FONT.name}", sans-serif`;
        ctx.fillStyle = hasBgImg && !isSplit ? "rgba(255,255,255,0.88)" : textColor + "CC";
        slide.body.split("\n").flatMap(p => wrapText(ctx, p, contentW)).forEach(ln => { y += (isSplit ? 30 : 36) * 1.6; ctx.fillText(ln, padX, y); });
      }
      if (slide.type === "cta") {
        y += 50; const btnTxt = "Подписаться →";
        ctx.font = `700 32px "${f.name}", sans-serif`;
        const bw = ctx.measureText(btnTxt).width + 120;
        ctx.fillStyle = t.accent; roundRect(ctx, padX, y - 10, bw, 72, 60); ctx.fill();
        ctx.fillStyle = t.isDark || hasBgImg ? "#0F0F0F" : "#FFFFFF";
        ctx.fillText(btnTxt, padX + 60, y + 38);
      }
    };

    const drawFooter = (textColor, padX, footerRight) => {
      const fy = h - 50;
      if (expertName) { ctx.font = `500 26px "${BODY_FONT.name}", sans-serif`; ctx.fillStyle = hasBgImg && !isSplit ? "rgba(255,255,255,0.65)" : textColor + "88"; ctx.fillText(expertName, padX + (logo ? 64 : 0), fy); }
      ctx.font = `500 28px "${f.name}", sans-serif`;
      ctx.fillStyle = hasBgImg && !isSplit ? "rgba(255,255,255,0.45)" : textColor + "55";
      const pg = `${index + 1}/${slides.length}`; ctx.fillText(pg, footerRight - ctx.measureText(pg).width, fy);
    };

    const finalize = () => {
      const link = document.createElement("a"); link.download = `slide_${index + 1}.png`; link.href = canvas.toDataURL("image/png"); link.click();
    };

    const drawScene = (bgImg) => {
      if (isSplit && bgImg) {
        const splitW = Math.floor(w * 0.45);
        ctx.drawImage(bgImg, 0, 0, splitW, h);
        ctx.fillStyle = t.bg; ctx.fillRect(splitW, 0, w - splitW, h);
        const barGrad = ctx.createLinearGradient(splitW, 0, w, 0); barGrad.addColorStop(0, t.accent); barGrad.addColorStop(1, t.accent + "88");
        ctx.fillStyle = barGrad; ctx.fillRect(splitW, 0, w - splitW, 6);
        drawContent(t.text, splitW + 60, h * 0.25, w - splitW - 130);
        drawFooter(t.text, splitW + 60, w - 70);
      } else {
        if (bgImg) {
          ctx.drawImage(bgImg, 0, 0, w, h);
          ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(0, 0, w, h);
        } else {
          if (slide.type === "cover") { const g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, t.bg); g.addColorStop(1, t.secondary); ctx.fillStyle = g; }
          else ctx.fillStyle = t.bg;
          ctx.fillRect(0, 0, w, h);
        }
        const barG = ctx.createLinearGradient(0, 0, w, 0); barG.addColorStop(0, t.accent); barG.addColorStop(1, t.accent + "88");
        ctx.fillStyle = barG; ctx.fillRect(0, 0, w, slide.type === "cover" ? 8 : 6);
        if (slide.type === "quote") { ctx.font = `900 200px "${f.name}", serif`; ctx.fillStyle = hasBgImg ? "rgba(255,255,255,0.15)" : t.accent + "25"; ctx.fillText('"', 60, 220); }
        const tc = hasBgImg ? "#FFFFFF" : t.text;
        drawContent(tc, 80, h * (slide.type === "cover" ? 0.3 : 0.2), w - 160);
        drawFooter(tc, 80, w - 80);
      }
      finalize();
    };

    if (hasBgImg) {
      const img = new Image(); img.crossOrigin = "anonymous";
      img.onload = () => drawScene(img);
      img.onerror = () => drawScene(null);
      img.src = slide.bgImage;
    } else {
      drawScene(null);
    }
  }, [slides, theme, font, format, logo, expertName, customAccent]);

  const exportAll = async () => {
    setExportingAll(true);
    for (let i = 0; i < slides.length; i++) { await new Promise(r => setTimeout(() => { exportSlide(i); r(); }, 600)); }
    setExportingAll(false);
  };

  const updateSlide = (i, s) => setSlides(sl => sl.map((x, j) => j === i ? s : x));
  const addSlide = () => { if (slides.length >= 10) return; setSlides(s => [...s, { type: "content", title: "Новый слайд", body: "Текст", bgMode: "color" }]); setActiveSlide(slides.length); };
  const removeSlide = (i) => { if (slides.length <= 2) return; setSlides(s => s.filter((_, j) => j !== i)); if (activeSlide >= slides.length - 1) setActiveSlide(Math.max(0, slides.length - 2)); };

  /* ── UI ── */
  const sectionLabel = (text) => (
    <label style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6, display: "block" }}>{text}</label>
  );

  const previewW = format === "vertical" ? 1080 * 0.22 : 1080 * 0.25;
  const previewH = format === "vertical" ? 1350 * 0.22 : 1080 * 0.25;

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: "#F3F1EE", minHeight: "100vh", color: "#1A1A1A" }}>
      <LoadFonts />

      {/* Header */}
      <div style={{ background: "#FFF", borderBottom: "1px solid #E8E5E0", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg, #E85D3A, #FF8A65)", display: "flex", alignItems: "center", justifyContent: "center", color: "#FFF", fontWeight: 800, fontSize: 16 }}>C</div>
          <span style={{ fontWeight: 700, fontSize: 17, letterSpacing: "-0.02em" }}>Carousel Studio</span>
          <span style={{ fontSize: 11, color: "#999", fontWeight: 500, background: "#F3F1EE", padding: "3px 8px", borderRadius: 6 }}>v2.0</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => exportSlide(activeSlide)}
            style={{ padding: "9px 18px", borderRadius: 10, border: "1px solid #E5E5E5", background: "#FFF", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans'" }}>
            ↓ Слайд {activeSlide + 1}
          </button>
          <button onClick={exportAll} disabled={exportingAll}
            style={{ padding: "9px 20px", borderRadius: 10, border: "none", background: exportingAll ? "#999" : "linear-gradient(135deg, #E85D3A, #FF8A65)", color: "#FFF", fontSize: 13, fontWeight: 700, cursor: exportingAll ? "wait" : "pointer", fontFamily: "'DM Sans'" }}>
            {exportingAll ? "Экспорт..." : "↓ Все PNG"}
          </button>
        </div>
      </div>

      <div style={{ display: "flex", minHeight: "calc(100vh - 63px)" }}>
        {/* ══════ LEFT PANEL ══════ */}
        <div style={{ width: 380, minWidth: 380, background: "#FFF", borderRight: "1px solid #E8E5E0", overflowY: "auto", maxHeight: "calc(100vh - 63px)" }}>
          <div style={{ display: "flex", borderBottom: "1px solid #E8E5E0" }}>
            {[{ key: "ai", label: "🤖 AI" }, { key: "design", label: "🎨 Дизайн" }, { key: "slides", label: "📑 Слайды" }].map(t2 => (
              <button key={t2.key} onClick={() => setTab(t2.key)}
                style={{ flex: 1, padding: "13px 6px", border: "none", borderBottom: tab === t2.key ? "2px solid #E85D3A" : "2px solid transparent", background: "none", fontSize: 12, fontWeight: tab === t2.key ? 700 : 500, color: tab === t2.key ? "#E85D3A" : "#888", cursor: "pointer", fontFamily: "'DM Sans'" }}>
                {t2.label}
              </button>
            ))}
          </div>

          <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>

            {/* ── AI TAB ── */}
            {tab === "ai" && (<>
              <div>
                {sectionLabel("OpenAI API Key")}
                <div style={{ position: "relative" }}>
                  <input type={showApiKey ? "text" : "password"} value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-..."
                    style={{ width: "100%", padding: "10px 40px 10px 14px", borderRadius: 10, border: "1px solid #E5E5E5", fontSize: 13, fontFamily: "monospace", boxSizing: "border-box" }} />
                  <button onClick={() => setShowApiKey(!showApiKey)} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 14 }}>
                    {showApiKey ? "🙈" : "👁"}
                  </button>
                </div>
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  {sectionLabel("Системный промпт (роль AI)")}
                  <button onClick={() => setShowSystemPrompt(!showSystemPrompt)}
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#E85D3A", fontWeight: 600, fontFamily: "'DM Sans'" }}>
                    {showSystemPrompt ? "Свернуть ▲" : "Настроить ▼"}
                  </button>
                </div>
                {!showSystemPrompt && (
                  <div style={{ background: "#F9FAFB", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#6B7280", lineHeight: 1.4, border: "1px solid #F0F0F0" }}>
                    ✅ Настроен промпт для создания каруселей. Нажмите «Настроить» чтобы изменить.
                  </div>
                )}
                {showSystemPrompt && (
                  <div>
                    <textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} rows={10}
                      style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #E5E5E5", fontSize: 12, fontFamily: "'DM Sans'", resize: "vertical", boxSizing: "border-box", lineHeight: 1.5 }} />
                    <button onClick={() => setSystemPrompt(DEFAULT_SYSTEM_PROMPT)}
                      style={{ marginTop: 6, background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#999", fontFamily: "'DM Sans'", textDecoration: "underline" }}>
                      Сбросить к дефолту
                    </button>
                  </div>
                )}
              </div>

              <div style={{ height: 1, background: "#F0EDE8", margin: "4px 0" }} />

              <div>
                {sectionLabel("Опишите или надиктуйте тему карусели")}
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <textarea value={userPrompt} onChange={(e) => setUserPrompt(e.target.value)}
                    placeholder={"Напишите или надиктуйте тему...\n\nНапример:\n• 7 ошибок начинающих предпринимателей\n• Карусель про медитацию для психолога\n• Или просто расскажите голосом о чём пост"}
                    rows={6}
                    style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: "1px solid #E5E5E5", fontSize: 13, fontFamily: "'DM Sans'", resize: "vertical", boxSizing: "border-box", lineHeight: 1.5 }} />
                  <VoiceButton
                    disabled={aiLoading}
                    onResult={(text) => setUserPrompt(text)}
                  />
                </div>
                <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>🎤 Нажмите микрофон чтобы надиктовать голосом</div>
              </div>

              <button onClick={generateWithAI} disabled={!apiKey || !userPrompt || aiLoading}
                style={{
                  padding: 14, borderRadius: 12, border: "none",
                  background: (!apiKey || !userPrompt || aiLoading) ? "#D1D5DB" : "linear-gradient(135deg, #8B5CF6, #A78BFA)",
                  color: "#FFF", fontSize: 14, fontWeight: 700,
                  cursor: (!apiKey || !userPrompt || aiLoading) ? "default" : "pointer",
                  fontFamily: "'DM Sans'",
                }}>
                {aiLoading ? "⏳ Генерирую карусель..." : "✨ Сгенерировать карусель"}
              </button>
            </>)}

            {/* ── DESIGN TAB ── */}
            {tab === "design" && (<>
              <div>
                {sectionLabel("Формат")}
                <div style={{ display: "flex", gap: 8 }}>
                  {[{ key: "vertical", label: "1080×1350" }, { key: "square", label: "1080×1080" }].map(f2 => (
                    <button key={f2.key} onClick={() => setFormat(f2.key)}
                      style={{ flex: 1, padding: 10, borderRadius: 10, border: format === f2.key ? "2px solid #E85D3A" : "1px solid #E5E5E5", background: format === f2.key ? "#FEF3F0" : "#FFF", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans'" }}>
                      {f2.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                {sectionLabel("Тема")}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {Object.entries(THEMES).map(([k, v]) => (
                    <button key={k} onClick={() => setTheme(k)}
                      style={{ padding: 10, borderRadius: 12, border: theme === k ? "2px solid #E85D3A" : "1px solid #E5E5E5", background: "#FFF", cursor: "pointer", textAlign: "left", fontFamily: "'DM Sans'" }}>
                      <div style={{ display: "flex", gap: 3, marginBottom: 5 }}>
                        <div style={{ width: 14, height: 14, borderRadius: 3, background: v.bg, border: "1px solid #E5E5E5" }} />
                        <div style={{ width: 14, height: 14, borderRadius: 3, background: v.accent }} />
                        <div style={{ width: 14, height: 14, borderRadius: 3, background: v.text }} />
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{v.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                {sectionLabel("Бренд-цвет")}
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input type="color" value={customAccent || currentTheme.accent} onChange={(e) => setCustomAccent(e.target.value)}
                    style={{ width: 40, height: 40, border: "none", borderRadius: 10, cursor: "pointer" }} />
                  <input value={customAccent} onChange={(e) => setCustomAccent(e.target.value)} placeholder={currentTheme.accent}
                    style={{ flex: 1, padding: "8px 12px", borderRadius: 10, border: "1px solid #E5E5E5", fontSize: 13, fontFamily: "monospace" }} />
                  {customAccent && <button onClick={() => setCustomAccent("")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14 }}>✕</button>}
                </div>
              </div>

              <div>
                {sectionLabel("Шрифт заголовков")}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {Object.entries(FONTS).map(([k, v]) => (
                    <button key={k} onClick={() => setFont(k)}
                      style={{ padding: "7px 14px", borderRadius: 10, border: font === k ? "2px solid #E85D3A" : "1px solid #E5E5E5", background: font === k ? "#FEF3F0" : "#FFF", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: `'${v.name}'` }}>
                      {v.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                {sectionLabel("Имя эксперта")}
                <input value={expertName} onChange={(e) => setExpertName(e.target.value)} placeholder="@username"
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #E5E5E5", fontSize: 13, fontFamily: "'DM Sans'", boxSizing: "border-box" }} />
              </div>

              <div>
                {sectionLabel("Логотип / Аватар")}
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {logo && <img src={logo} alt="" style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover" }} />}
                  <button onClick={() => fileRef.current?.click()}
                    style={{ padding: "8px 16px", borderRadius: 10, border: "1px dashed #CCC", background: "#FAFAFA", fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans'" }}>
                    {logo ? "Заменить" : "Загрузить"}
                  </button>
                  {logo && <button onClick={() => setLogo(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14 }}>✕</button>}
                  <input ref={fileRef} type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: "none" }} />
                </div>
              </div>
            </>)}

            {/* ── SLIDES TAB ── */}
            {tab === "slides" && (<>
              {slides.map((sl, i) => (
                <div key={i}>
                  <SlideEditor slide={sl} index={i} onChange={(ns) => updateSlide(i, ns)} onRemove={() => removeSlide(i)} canRemove={slides.length > 2} />
                  {(sl.bgMode === "overlay" || sl.bgMode === "split") && (
                    <button onClick={() => generateBgImage(i)} disabled={!apiKey || dalleLoading === i}
                      style={{
                        marginTop: 6, width: "100%", padding: "8px", borderRadius: 8,
                        border: "1px dashed #A78BFA", background: dalleLoading === i ? "#EDE9FE" : "#F5F3FF",
                        fontSize: 12, fontWeight: 600, color: "#7C3AED", cursor: !apiKey || dalleLoading === i ? "default" : "pointer",
                        fontFamily: "'DM Sans'",
                      }}>
                      {dalleLoading === i ? "🎨 Генерирую фото..." : "🤖 Сгенерировать фото через DALL-E"}
                    </button>
                  )}
                </div>
              ))}
              {slides.length < 10 && (
                <button onClick={addSlide}
                  style={{ padding: 12, borderRadius: 12, border: "2px dashed #D1D5DB", background: "none", fontSize: 13, fontWeight: 600, color: "#9CA3AF", cursor: "pointer", fontFamily: "'DM Sans'" }}>
                  + Добавить слайд
                </button>
              )}
            </>)}
          </div>
        </div>

        {/* ══════ PREVIEW AREA ══════ */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, gap: 16, overflow: "auto" }}>
          <div style={{ borderRadius: 16, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.06)", width: previewW, height: previewH }}>
            <SlidePreview
              slide={slides[activeSlide]} theme={theme} font={font} format={format}
              logo={logo} expertName={expertName} slideIndex={activeSlide}
              totalSlides={slides.length} customAccent={customAccent}
            />
          </div>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
            {slides.map((_, i) => (
              <button key={i} onClick={() => setActiveSlide(i)}
                style={{
                  width: 40, height: 40, borderRadius: 10,
                  border: i === activeSlide ? "2px solid #E85D3A" : "1px solid #D1D5DB",
                  background: i === activeSlide ? "#FEF3F0" : "#FFF",
                  fontSize: 13, fontWeight: i === activeSlide ? 700 : 500,
                  color: i === activeSlide ? "#E85D3A" : "#888",
                  cursor: "pointer", fontFamily: "'DM Sans'",
                }}>
                {i + 1}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", maxWidth: 700 }}>
            {slides.map((sl, i) => {
              const tw = format === "vertical" ? 1080 * 0.06 : 1080 * 0.07;
              const th = format === "vertical" ? 1350 * 0.06 : 1080 * 0.07;
              return (
                <div key={i} onClick={() => setActiveSlide(i)}
                  style={{ borderRadius: 6, overflow: "hidden", cursor: "pointer", opacity: i === activeSlide ? 1 : 0.55, transition: "opacity .2s", border: i === activeSlide ? "2px solid #E85D3A" : "2px solid transparent", width: tw, height: th }}>
                  <SlidePreview slide={sl} theme={theme} font={font} format={format} logo={null} expertName="" slideIndex={i} totalSlides={slides.length} customAccent={customAccent} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
