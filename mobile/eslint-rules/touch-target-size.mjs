/**
 * local/touch-target-size — catch the A11Y-04 recurring defect CLASS: a raw
 * interactive text-link touchable that ships below the 48px 45+ touch floor
 * (D35). This is what kept regressing (SignIn "Resend", LockScreen, Settings
 * "Try again", ReportDetail "Rename") because a numeric source scan can't see
 * a `<Pressable>` that simply has no minHeight at all. An AST rule can.
 *
 * It flags a RAW `<Pressable>` / `<TouchableOpacity>` when ALL hold:
 *   - it has an `onPress` (genuinely interactive)                       [E6]
 *   - its only element children are `<Text>` (the text-link class)      [E1]
 *   - it has NO `hitSlop` (the author didn't extend the tap area)       [E2]
 *   - its `style` resolves to a FLAT box — not a sized surface: no      [E3]
 *     `minHeight`/`minWidth` >= 48, no `backgroundColor`, no `borderWidth`
 * The fix: route it through TouchTargetLink, or add `minHeight: 48`.
 *
 * The "flat, not a sized surface" test is what separates a bare inline text
 * link (the defect — e.g. SignIn "Resend", a "Show details" toggle) from a
 * tappable CARD (`backgroundColor`/`borderWidth` + padding, reliably >= 48) or
 * a chip whose tap area is extended with `hitSlop`. Cards and hitSlop targets
 * are exempt; flat text links are not.
 *
 * Deliberate NARROWINGS (we narrow detection, never the 48px standard):
 *   - E1: a touchable wrapping a View/Image/icon/any non-Text element is NOT
 *     flagged — its content may provide height we can't measure statically.
 *   - E2: any `hitSlop` exempts. The exact effective size of hitSlop + visible
 *     text isn't statically computable (the documented D35 attention chips use
 *     vertical hitSlop deliberately); proving a hitSlop reaches 48 is render-
 *     test/Maestro territory, not a static rule's.
 *   - E3: `backgroundColor`/`borderWidth` mark a sized surface (card/button),
 *     which carries its own height via padding — exempt. Theme-token padding
 *     (`theme.spacing.*`) isn't a numeric literal so can't be summed here; the
 *     surface signal stands in for it.
 *   - E4: TouchTargetLink / PressableScale (custom components) aren't matched by
 *     name, so they're exempt by construction; the rule targets only the RN
 *     primitives, steering new code to TouchTargetLink.
 *   - E5: if `style` is unresolvable in-file (imported ref, a function, an
 *     array with a conditional element), we SKIP rather than false-flag. A
 *     single-file rule can't follow cross-file styles. Documented blind spot.
 */

const TOUCHABLES = new Set([
  "Pressable",
  "TouchableOpacity",
  "TouchableHighlight",
  "TouchableWithoutFeedback",
]);
const MIN = 48;

function jsxName(openingEl) {
  const n = openingEl && openingEl.name;
  return n && n.type === "JSXIdentifier" ? n.name : null;
}

function getAttr(openingEl, name) {
  return openingEl.attributes.find(
    (a) => a.type === "JSXAttribute" && a.name && a.name.name === name,
  );
}

/**
 * Is this style ObjectExpression a "sized surface" — i.e. carries its own
 * reliable >=48 height? True when it has a numeric minHeight/minWidth literal
 * >= MIN, OR a `backgroundColor`/`borderWidth` (a filled/bordered card/button
 * surface, which is padded to >= 48 — distinct from a bare inline text link).
 */
function objIsSizedSurface(objExpr) {
  if (!objExpr || objExpr.type !== "ObjectExpression") return false;
  return objExpr.properties.some((p) => {
    if (p.type !== "Property" || !p.key) return false;
    const k = p.key.name;
    if (k === "backgroundColor" || k === "borderWidth") return true;
    if (
      (k === "minHeight" || k === "minWidth") &&
      p.value &&
      p.value.type === "Literal" &&
      typeof p.value.value === "number" &&
      p.value.value >= MIN
    ) {
      return true;
    }
    return false;
  });
}

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Raw interactive text-link touchables must guarantee a >=48px touch target.",
    },
    schema: [],
    messages: {
      tooSmall:
        "Interactive <{{tag}}> wrapping only <Text> is a flat box (no minHeight/minWidth>={{min}}, no background/border surface, no hitSlop) — it renders below the {{min}}px 45+ touch floor. Route it through TouchTargetLink (src/components/TouchTargetLink.tsx) or add minHeight: {{min}}. (D35.)",
    },
  },
  create(context) {
    /** style name -> is a sized surface (from in-file StyleSheet.create). */
    const styleSurface = new Map();
    const candidates = [];

    /** "ok"(sized surface) | "flat"(resolved, not a surface) | "unresolvable". */
    function styleIsSizedSurface(styleAttr) {
      if (!styleAttr) return "flat"; // no style prop at all -> bare flat box
      const v = styleAttr.value;
      if (!v || v.type !== "JSXExpressionContainer") return "unresolvable";

      const checkOne = (e) => {
        if (!e) return "unresolvable";
        if (e.type === "ObjectExpression") return objIsSizedSurface(e) ? "ok" : "flat";
        if (
          e.type === "MemberExpression" &&
          e.property &&
          e.property.name &&
          styleSurface.has(e.property.name)
        ) {
          return styleSurface.get(e.property.name) ? "ok" : "flat";
        }
        return "unresolvable"; // imported ref / unknown style name / call etc.
      };

      const expr = v.expression;
      if (expr.type === "ArrayExpression") {
        let sawFlat = false;
        for (const el of expr.elements) {
          if (!el) continue;
          // `cond && styles.x` / `cond ? a : b` -> can't statically resolve
          if (el.type === "LogicalExpression" || el.type === "ConditionalExpression") {
            return "unresolvable";
          }
          const r = checkOne(el);
          if (r === "ok") return "ok";
          if (r === "unresolvable") return "unresolvable";
          sawFlat = true; // "flat"
        }
        return sawFlat ? "flat" : "unresolvable";
      }
      return checkOne(expr);
    }

    return {
      CallExpression(node) {
        // Collect `StyleSheet.create({ name: { ... } })` so style refs resolve.
        if (
          node.callee.type === "MemberExpression" &&
          node.callee.object &&
          node.callee.object.name === "StyleSheet" &&
          node.callee.property &&
          node.callee.property.name === "create" &&
          node.arguments[0] &&
          node.arguments[0].type === "ObjectExpression"
        ) {
          for (const p of node.arguments[0].properties) {
            if (
              p.type === "Property" &&
              p.key &&
              p.value &&
              p.value.type === "ObjectExpression"
            ) {
              const name =
                p.key.name ?? (p.key.type === "Literal" ? p.key.value : null);
              if (name != null) styleSurface.set(name, objIsSizedSurface(p.value));
            }
          }
        }
      },
      JSXOpeningElement(node) {
        const tag = jsxName(node);
        if (!tag || !TOUCHABLES.has(tag)) return; // E4: only RN primitives
        if (!getAttr(node, "onPress")) return; // E6: interactive only
        if (getAttr(node, "hitSlop")) return; // E2: hitSlop extends the tap area
        const el = node.parent; // the JSXElement
        const elemChildren = (el.children || []).filter(
          (c) => c.type === "JSXElement",
        );
        if (elemChildren.length === 0) return; // nothing measurable
        const allText = elemChildren.every(
          (c) => jsxName(c.openingElement) === "Text",
        );
        if (!allText) return; // E1: wraps a non-Text element -> skip
        candidates.push({ node, tag, styleAttr: getAttr(node, "style") });
      },
      "Program:exit"() {
        for (const c of candidates) {
          // "ok" -> sized surface; "unresolvable" -> E5 (skip, no false-flag).
          if (styleIsSizedSurface(c.styleAttr) === "flat") {
            context.report({
              node: c.node,
              messageId: "tooSmall",
              data: { tag: c.tag, min: MIN },
            });
          }
        }
      },
    };
  },
};
