export async function prepareClientLogo(file: File): Promise<string> {
  if (file.size > 10 * 1024 * 1024 || !["image/png", "image/jpeg", "image/webp", "image/svg+xml"].includes(file.type)) throw new Error("Elige un logotipo PNG, JPG, WebP o SVG de hasta 10 MB.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("No se puede leer esta imagen. Prueba con un archivo PNG o JPG.")); image.src = url; });
    if (!image.naturalWidth || !image.naturalHeight) throw new Error("La imagen no tiene dimensiones válidas.");
    const scale = Math.min(1, 768 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No se ha podido preparar el logotipo. Prueba con otro navegador.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of [.9, .75, .6]) {
      const logo = canvas.toDataURL("image/webp", quality);
      if (logo.length <= 700000) return logo;
    }
    throw new Error("No se ha podido reducir la imagen. Prueba con un logotipo más pequeño.");
  } finally { URL.revokeObjectURL(url); }
}
