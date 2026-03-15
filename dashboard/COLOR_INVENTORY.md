# Complete Color Inventory

**Generated:** 2026-03-15  
**Source:** Automated scan of `/dashboard/src` directory

---

## Background Colors (bg-*)

### Gray (9 shades)
```
bg-gray-50    (29 instances)
bg-gray-100   (15 instances)
bg-gray-200
bg-gray-300
bg-gray-400
bg-gray-700
bg-gray-800
bg-gray-900   (12 instances)
bg-gray-950
```

### Blue (7 shades)
```
bg-blue-50
bg-blue-100
bg-blue-500
bg-blue-600
bg-blue-700
```

### Green (7 shades)
```
bg-green-50
bg-green-100
bg-green-500
bg-green-600
bg-green-700
```

### Red (7 shades)
```
bg-red-50
bg-red-100
bg-red-500
bg-red-600
bg-red-700
```

### Amber (3 shades)
```
bg-amber-50
bg-amber-100
bg-amber-500
```

### Yellow (1 shade)
```
bg-yellow-100
```

### Indigo (3 shades)
```
bg-indigo-100
bg-indigo-500
bg-indigo-600
```

### Purple (2 shades)
```
bg-purple-50
bg-purple-100
```

### Other Single-Shade Backgrounds
```
bg-orange-100
bg-pink-100
bg-teal-100
bg-cyan-100
bg-emerald-100
```

### Neutral
```
bg-white   (37 instances)
bg-black  (7 instances)
```

---

## Text Colors (text-*)

### Gray (8 shades)
```
text-gray-100
text-gray-300
text-gray-400   (37 instances)
text-gray-500   (72 instances) ← MOST USED
text-gray-600   (24 instances)
text-gray-700   (38 instances)
text-gray-800
text-gray-900   (52 instances)
```

### Blue (6 shades)
```
text-blue-300
text-blue-400
text-blue-500
text-blue-600
text-blue-700
text-blue-800
```

### Green (5 shades)
```
text-green-400
text-green-500
text-green-600
text-green-700
text-green-800
```

### Red (5 shades)
```
text-red-400
text-red-500   (10 instances)
text-red-600
text-red-700
text-red-800
```

### Amber (5 shades)
```
text-amber-400
text-amber-500
text-amber-600
text-amber-700
text-amber-800
```

### Indigo (3 shades)
```
text-indigo-600
text-indigo-700
text-indigo-900
```

### Purple (3 shades)
```
text-purple-600
text-purple-700
text-purple-800
```

### Other Single-Shade Text Colors
```
text-yellow-700
text-yellow-800
text-orange-700
text-pink-700
text-teal-700
text-cyan-700
text-emerald-700
```

### Neutral
```
text-white   (21 instances)
```

---

## Border Colors (border-*)

### Gray (5 shades)
```
border-gray-100
border-gray-200   (36 instances) ← MOST USED
border-gray-300   (27 instances)
border-gray-500
border-gray-900
```

### Blue (5 shades)
```
border-blue-200
border-blue-500
border-blue-600
border-blue-700
```

### Green (3 shades)
```
border-green-200
border-green-300
border-green-600
```

### Red (5 shades)
```
border-red-200
border-red-300
border-red-400
border-red-500
```

### Other Single-Shade Borders
```
border-amber-200
border-yellow-200
border-indigo-200
border-indigo-500
border-orange-200
border-pink-200
border-purple-200
border-teal-200
border-cyan-200
border-emerald-200
```

### Neutral
```
border-transparent   (9 instances)
```

---

## Shadow Colors (shadow-*)

```
shadow-sm   (15 instances)
shadow-lg   (4 instances)
```

---

## Ring Colors (ring-*)

```
ring-gray-900   (8 instances)
ring-blue-200
ring-blue-500
ring-indigo-500   (5 instances)
```

---

## Custom Hex Colors

**File:** `src/App.css`

```css
#646cffaa  /* Violet with 67% opacity - logo hover shadow */
#61dafbaa  /* Sky blue with 67% opacity - React logo hover shadow */
#888       /* Gray - read-the-docs text color */
```

**Tailwind Equivalents:**
- `#646cffaa` → `rgba(99, 102, 241, 0.67)` or `indigo-500/67`
- `#61dafbaa` → `rgba(97, 218, 191, 0.67)` or `teal-400/67`
- `#888` → `rgb(136, 136, 136)` or `gray-500` but closer to `gray-400`

---

## Color Usage by Semantic Meaning

### Status Colors

| Status | Background | Text | Usage |
|--------|-----------|------|-------|
| **Pending** | yellow-100, gray-100⚠️ | yellow-800, gray-600⚠️ | Inconsistent! |
| **Running** | blue-50, blue-100⚠️ | blue-700, blue-800⚠️ | Inconsistent shades |
| **Success** | green-50, green-100⚠️ | green-700, green-800⚠️ | Inconsistent shades |
| **Failed** | red-50, red-100⚠️ | red-700, red-800⚠️ | Inconsistent shades |
| **Warning** | amber-50, yellow-100⚠️ | amber-700, yellow-800⚠️ | Inconsistent families |
| **Timeout** | amber-50 | amber-700 | Consistent |

### Interactive States

| State | Background | Text | Border |
|-------|-----------|------|--------|
| **Hover** | gray-50, red-50 | gray-700, blue-700 | - |
| **Focus** | - | - | indigo-500, blue-500 |
| **Disabled** | gray-400 | white | - |

### Error States

| Element | Colors |
|---------|--------|
| Text | red-500, red-600, red-700 |
| Background | red-50 |
| Border | red-300, red-500 |

### Success States

| Element | Colors |
|---------|--------|
| Text | green-600, green-700 |
| Background | green-50 |
| Border | green-200 |

### Structural/Neutral

| Element | Colors |
|---------|--------|
| Primary Background | white |
| Secondary Background | gray-50 |
| Tertiary Background | gray-100 |
| Dark Background | gray-900, gray-950 |
| Primary Text | gray-900 |
| Secondary Text | gray-500 |
| Muted Text | gray-400 |
| Default Border | gray-200 |
| Thick Border | gray-300 |

---

## Unused or Rarely Used Colors

Consider removing if not planned for use:

- **Pink:** Only 100 (bg), 700 (text)
- **Orange:** Only 100 (bg), 700 (text)
- **Teal:** Only 100 (bg), 700 (text)
- **Cyan:** Only 100 (bg), 700 (text)
- **Emerald:** Only 100 (bg), 700 (text)
- **Purple:** Only 50, 100 (bg), 600, 700, 800 (text)
- **Indigo:** Only 100 (bg), 600, 700, 900 (text)

---

## Recommendations

1. ✅ **Keep:** Gray, Blue, Green, Red (core colors, well-used)
2. ✅ **Keep:** Amber (for warnings, better than yellow)
3. ⚠️ **Consider:** Removing Yellow (standardize on Amber)
4. ⚠️ **Consider:** Removing Indigo, Purple, Pink, Orange, Teal, Cyan, Emerald unless specifically needed

---

**Total Unique Color Classes:** 119  
**Total Usage Instances:** 514  
**Most Used Color:** gray (200+ instances across all properties)  
**Most Underutilized:** Pink, Orange, Teal, Cyan, Emerald (1-2 instances each)

