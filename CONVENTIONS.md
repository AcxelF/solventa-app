# Convenciones de diseño — Solventa

Este documento describe los patrones de UI que deben seguir **todos** los
componentes nuevos. Es de lectura obligatoria antes de agregar cualquier
vista o modal.

## Modales (animación)

Todo modal de la app usa el componente compartido
`frontend/src/components/ui/Modal.jsx`. No se crean modales nuevos desde
cero: se reutiliza este componente.

**Patrón de animación:**

- **Abrir:** fade + scale de `opacity 0 / scale 0.95` → `opacity 1 / scale 1`.
- **Cerrar:** lo inverso (`opacity 1 / scale 1` → `opacity 0 / scale 0.95`).
- **Duración:** `150ms` (clases de Tailwind `duration-150`).
- **Easing:** `ease-out` al abrir, `ease-in` al cerrar (vía
  `transitionTimingFunction` inline).
- **Overlay** (`bg-black/50`): hace fade in/out con la misma duración.

**Implementación interna (no replicar, solo heredar):**

```jsx
const ANIM_MS = 150; // duración en ms

// El modal arranca con `open=false` y pasa a `open=true` en el primer frame
// (requestAnimationFrame). Al cerrar, `handleClose()` pone `closing=true` y
// `open=false`, y llama `onClose()` tras `ANIM_MS + 10ms` para que el
// componente padre lo desmonte recién después de la animación.
```

**Reglas:**

1. El padre debe renderizar `<Modal>` condicionalmente (ej. `{form && <Modal …>}`).
2. Nunca llamar a `onClose` directo sin pasar por `handleClose`: rompería la
   animación de salida. Todos los cierres (X, clic en overlay) pasan por ahí.
3. Duraciones/easing: usar exactamente los de arriba. Cambiarlos en `Modal.jsx`
   solo si el diseño lo pide, y actualizar este documento.

## Modo claro / oscuro

- El tema vive en `frontend/src/context/ThemeContext.jsx` (`useTheme()`).
- La preferencia se guarda en `localStorage` (`"solventa-theme"`) y aplica la
  clase `dark` en `<html>`.
- **Nunca hardcodear colores de fondo/texto** de la interfaz: usar los tokens
  de Tailwind `bg`, `surface`, `surface-2`, `text`, `text-secondary`,
  `text-muted`, `border`. Están definidos como variables CSS en
  `src/index.css` (`:root` para claro, `.dark` para oscuro).
- Los colores de **marca** (cuentas) y de **categoría** son datos de la app y
  no cambian con el tema.

## Moneda

- Usar SIEMPRE `formatMoney()` de `frontend/src/utils/format.js`.
- Formato unificado: `S/ X,XXX.XX` (símbolo de soles, coma de miles, punto
  decimal, siempre dos decimales). No repetir `Intl.NumberFormat` en
  componentes.

## Íconos de categoría/cuenta

- Usar el componente `frontend/src/components/ui/IconBadge.jsx`: círculo con
  el color de la categoría y el ícono en blanco o en un tono oscuro del mismo
  color según contraste (utilidad `readableOn` en `src/utils/color.js`).
- No renderizar íconos sobre fondos de color "a mano" en cada vista.

## Listas

- Listas continuas: `<ul>` con `divide-y divide-border` dentro de un contenedor
  `rounded-2xl border border-border bg-surface`. Sin tarjeta/sombra por fila.
- Acciones (editar/eliminar): se muestran solo en hover, con
  `opacity-0 transition-opacity duration-150 group-hover:opacity-100` y la
  clase `group` en la fila.

## Tipografía y sombras

- Pesos regulares/medium para texto general. `font-semibold` solo para montos
  (`font-mono`), saldos y títulos de sección.
- Sombras: solo `shadow-soft` (definida en `tailwind.config.js`). Nada de
  sombras duras.
