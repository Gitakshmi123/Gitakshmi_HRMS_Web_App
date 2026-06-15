import {
  require_react
} from "./chunk-GAFYC2ZW.js";
import {
  __toESM
} from "./chunk-PR4QN5HX.js";

// node_modules/react-organizational-chart/dist/index.module.js
var e = __toESM(require_react());
function r(e3, r2) {
  return r2 || (r2 = e3.slice(0)), e3.raw = r2, e3;
}
var n = (function() {
  function e3(e4) {
    var r3 = this;
    this._insertTag = function(e5) {
      r3.container.insertBefore(e5, 0 === r3.tags.length ? r3.insertionPoint ? r3.insertionPoint.nextSibling : r3.prepend ? r3.container.firstChild : r3.before : r3.tags[r3.tags.length - 1].nextSibling), r3.tags.push(e5);
    }, this.isSpeedy = void 0 === e4.speedy ? false : e4.speedy, this.tags = [], this.ctr = 0, this.nonce = e4.nonce, this.key = e4.key, this.container = e4.container, this.prepend = e4.prepend, this.insertionPoint = e4.insertionPoint, this.before = null;
  }
  var r2 = e3.prototype;
  return r2.hydrate = function(e4) {
    e4.forEach(this._insertTag);
  }, r2.insert = function(e4) {
    this.ctr % (this.isSpeedy ? 65e3 : 1) == 0 && this._insertTag((function(e5) {
      var r4 = document.createElement("style");
      return r4.setAttribute("data-emotion", e5.key), void 0 !== e5.nonce && r4.setAttribute("nonce", e5.nonce), r4.appendChild(document.createTextNode("")), r4.setAttribute("data-s", ""), r4;
    })(this));
    var r3 = this.tags[this.tags.length - 1];
    if (true) {
      var n2 = 64 === e4.charCodeAt(0) && 105 === e4.charCodeAt(1);
      n2 && this._alreadyInsertedOrderInsensitiveRule && console.error("You're attempting to insert the following rule:\n" + e4 + "\n\n`@import` rules must be before all other types of rules in a stylesheet but other rules have already been inserted. Please ensure that `@import` rules are before all other rules."), this._alreadyInsertedOrderInsensitiveRule = this._alreadyInsertedOrderInsensitiveRule || !n2;
    }
    if (this.isSpeedy) {
      var t2 = (function(e5) {
        if (e5.sheet) return e5.sheet;
        for (var r4 = 0; r4 < document.styleSheets.length; r4++) if (document.styleSheets[r4].ownerNode === e5) return document.styleSheets[r4];
      })(r3);
      try {
        t2.insertRule(e4, t2.cssRules.length);
      } catch (r4) {
        /:(-moz-placeholder|-moz-focus-inner|-moz-focusring|-ms-input-placeholder|-moz-read-write|-moz-read-only|-ms-clear){/.test(e4) || console.error('There was a problem inserting the following rule: "' + e4 + '"', r4);
      }
    } else r3.appendChild(document.createTextNode(e4));
    this.ctr++;
  }, r2.flush = function() {
    this.tags.forEach(function(e4) {
      return e4.parentNode && e4.parentNode.removeChild(e4);
    }), this.tags = [], this.ctr = 0, this._alreadyInsertedOrderInsensitiveRule = false;
  }, e3;
})();
var t = "-ms-";
var o = "-webkit-";
var a = Math.abs;
var i = String.fromCharCode;
var s = Object.assign;
function c(e3) {
  return e3.trim();
}
function l(e3, r2, n2) {
  return e3.replace(r2, n2);
}
function u(e3, r2) {
  return e3.indexOf(r2);
}
function d(e3, r2) {
  return 0 | e3.charCodeAt(r2);
}
function f(e3, r2, n2) {
  return e3.slice(r2, n2);
}
function p(e3) {
  return e3.length;
}
function h(e3) {
  return e3.length;
}
function v(e3, r2) {
  return r2.push(e3), e3;
}
var m = 1;
var g = 1;
var y = 0;
var b = 0;
var w = 0;
var k = "";
function E(e3, r2, n2, t2, o2, a2, i2) {
  return { value: e3, root: r2, parent: n2, type: t2, props: o2, children: a2, line: m, column: g, length: i2, return: "" };
}
function x(e3, r2) {
  return s(E("", null, null, "", null, null, 0), e3, { length: -e3.length }, r2);
}
function N() {
  return w = b > 0 ? d(k, --b) : 0, g--, 10 === w && (g = 1, m--), w;
}
function O() {
  return w = b < y ? d(k, b++) : 0, g++, 10 === w && (g = 1, m++), w;
}
function _() {
  return d(k, b);
}
function C() {
  return b;
}
function A(e3, r2) {
  return f(k, e3, r2);
}
function $(e3) {
  switch (e3) {
    case 0:
    case 9:
    case 10:
    case 13:
    case 32:
      return 5;
    case 33:
    case 43:
    case 44:
    case 47:
    case 62:
    case 64:
    case 126:
    case 59:
    case 123:
    case 125:
      return 4;
    case 58:
      return 3;
    case 34:
    case 39:
    case 40:
    case 91:
      return 2;
    case 41:
    case 93:
      return 1;
  }
  return 0;
}
function S(e3) {
  return m = g = 1, y = p(k = e3), b = 0, [];
}
function D(e3) {
  return k = "", e3;
}
function V(e3) {
  return c(A(b - 1, z(91 === e3 ? e3 + 2 : 40 === e3 ? e3 + 1 : e3)));
}
function I(e3) {
  for (; (w = _()) && w < 33; ) O();
  return $(e3) > 2 || $(w) > 3 ? "" : " ";
}
function R(e3, r2) {
  for (; --r2 && O() && !(w < 48 || w > 102 || w > 57 && w < 65 || w > 70 && w < 97); ) ;
  return A(e3, C() + (r2 < 6 && 32 == _() && 32 == O()));
}
function z(e3) {
  for (; O(); ) switch (w) {
    case e3:
      return b;
    case 34:
    case 39:
      34 !== e3 && 39 !== e3 && z(w);
      break;
    case 40:
      41 === e3 && z(e3);
      break;
    case 92:
      O();
  }
  return b;
}
function j(e3, r2) {
  for (; O() && e3 + w !== 57 && (e3 + w !== 84 || 47 !== _()); ) ;
  return "/*" + A(r2, b - 1) + "*" + i(47 === e3 ? e3 : O());
}
function P(e3) {
  for (; !$(_()); ) O();
  return A(e3, b);
}
function T(e3) {
  return D(q("", null, null, null, [""], e3 = S(e3), 0, [0], e3));
}
function q(e3, r2, n2, t2, o2, a2, s2, c2, d2) {
  for (var f2 = 0, h2 = 0, m2 = s2, g2 = 0, y2 = 0, b2 = 0, w2 = 1, k2 = 1, E2 = 1, x2 = 0, A2 = "", $2 = o2, S2 = a2, D2 = t2, z2 = A2; k2; ) switch (b2 = x2, x2 = O()) {
    case 40:
      if (108 != b2 && 58 == z2.charCodeAt(m2 - 1)) {
        -1 != u(z2 += l(V(x2), "&", "&\f"), "&\f") && (E2 = -1);
        break;
      }
    case 34:
    case 39:
    case 91:
      z2 += V(x2);
      break;
    case 9:
    case 10:
    case 13:
    case 32:
      z2 += I(b2);
      break;
    case 92:
      z2 += R(C() - 1, 7);
      continue;
    case 47:
      switch (_()) {
        case 42:
        case 47:
          v(M(j(O(), C()), r2, n2), d2);
          break;
        default:
          z2 += "/";
      }
      break;
    case 123 * w2:
      c2[f2++] = p(z2) * E2;
    case 125 * w2:
    case 59:
    case 0:
      switch (x2) {
        case 0:
        case 125:
          k2 = 0;
        case 59 + h2:
          y2 > 0 && p(z2) - m2 && v(y2 > 32 ? Y(z2 + ";", t2, n2, m2 - 1) : Y(l(z2, " ", "") + ";", t2, n2, m2 - 2), d2);
          break;
        case 59:
          z2 += ";";
        default:
          if (v(D2 = G(z2, r2, n2, f2, h2, o2, c2, A2, $2 = [], S2 = [], m2), a2), 123 === x2) if (0 === h2) q(z2, r2, D2, D2, $2, a2, m2, c2, S2);
          else switch (g2) {
            case 100:
            case 109:
            case 115:
              q(e3, D2, D2, t2 && v(G(e3, D2, D2, 0, 0, o2, c2, A2, o2, $2 = [], m2), S2), o2, S2, m2, c2, t2 ? $2 : S2);
              break;
            default:
              q(z2, D2, D2, D2, [""], S2, 0, c2, S2);
          }
      }
      f2 = h2 = y2 = 0, w2 = E2 = 1, A2 = z2 = "", m2 = s2;
      break;
    case 58:
      m2 = 1 + p(z2), y2 = b2;
    default:
      if (w2 < 1) {
        if (123 == x2) --w2;
        else if (125 == x2 && 0 == w2++ && 125 == N()) continue;
      }
      switch (z2 += i(x2), x2 * w2) {
        case 38:
          E2 = h2 > 0 ? 1 : (z2 += "\f", -1);
          break;
        case 44:
          c2[f2++] = (p(z2) - 1) * E2, E2 = 1;
          break;
        case 64:
          45 === _() && (z2 += V(O())), g2 = _(), h2 = m2 = p(A2 = z2 += P(C())), x2++;
          break;
        case 45:
          45 === b2 && 2 == p(z2) && (w2 = 0);
      }
  }
  return a2;
}
function G(e3, r2, n2, t2, o2, i2, s2, u2, d2, p2, v2) {
  for (var m2 = o2 - 1, g2 = 0 === o2 ? i2 : [""], y2 = h(g2), b2 = 0, w2 = 0, k2 = 0; b2 < t2; ++b2) for (var x2 = 0, N2 = f(e3, m2 + 1, m2 = a(w2 = s2[b2])), O2 = e3; x2 < y2; ++x2) (O2 = c(w2 > 0 ? g2[x2] + " " + N2 : l(N2, /&\f/g, g2[x2]))) && (d2[k2++] = O2);
  return E(e3, r2, n2, 0 === o2 ? "rule" : u2, d2, p2, v2);
}
function M(e3, r2, n2) {
  return E(e3, r2, n2, "comm", i(w), f(e3, 2, -2), 0);
}
function Y(e3, r2, n2, t2) {
  return E(e3, r2, n2, "decl", f(e3, 0, t2), f(e3, t2 + 1, -1), t2);
}
function W(e3, r2) {
  switch ((function(e4, r3) {
    return (((r3 << 2 ^ d(e4, 0)) << 2 ^ d(e4, 1)) << 2 ^ d(e4, 2)) << 2 ^ d(e4, 3);
  })(e3, r2)) {
    case 5103:
      return o + "print-" + e3 + e3;
    case 5737:
    case 4201:
    case 3177:
    case 3433:
    case 1641:
    case 4457:
    case 2921:
    case 5572:
    case 6356:
    case 5844:
    case 3191:
    case 6645:
    case 3005:
    case 6391:
    case 5879:
    case 5623:
    case 6135:
    case 4599:
    case 4855:
    case 4215:
    case 6389:
    case 5109:
    case 5365:
    case 5621:
    case 3829:
      return o + e3 + e3;
    case 5349:
    case 4246:
    case 4810:
    case 6968:
    case 2756:
      return o + e3 + "-moz-" + e3 + t + e3 + e3;
    case 6828:
    case 4268:
      return o + e3 + t + e3 + e3;
    case 6165:
      return o + e3 + t + "flex-" + e3 + e3;
    case 5187:
      return o + e3 + l(e3, /(\w+).+(:[^]+)/, "-webkit-box-$1$2-ms-flex-$1$2") + e3;
    case 5443:
      return o + e3 + t + "flex-item-" + l(e3, /flex-|-self/, "") + e3;
    case 4675:
      return o + e3 + t + "flex-line-pack" + l(e3, /align-content|flex-|-self/, "") + e3;
    case 5548:
      return o + e3 + t + l(e3, "shrink", "negative") + e3;
    case 5292:
      return o + e3 + t + l(e3, "basis", "preferred-size") + e3;
    case 6060:
      return o + "box-" + l(e3, "-grow", "") + o + e3 + t + l(e3, "grow", "positive") + e3;
    case 4554:
      return o + l(e3, /([^-])(transform)/g, "$1-webkit-$2") + e3;
    case 6187:
      return l(l(l(e3, /(zoom-|grab)/, o + "$1"), /(image-set)/, o + "$1"), e3, "") + e3;
    case 5495:
    case 3959:
      return l(e3, /(image-set\([^]*)/, o + "$1$`$1");
    case 4968:
      return l(l(e3, /(.+:)(flex-)?(.*)/, "-webkit-box-pack:$3-ms-flex-pack:$3"), /s.+-b[^;]+/, "justify") + o + e3 + e3;
    case 4095:
    case 3583:
    case 4068:
    case 2532:
      return l(e3, /(.+)-inline(.+)/, o + "$1$2") + e3;
    case 8116:
    case 7059:
    case 5753:
    case 5535:
    case 5445:
    case 5701:
    case 4933:
    case 4677:
    case 5533:
    case 5789:
    case 5021:
    case 4765:
      if (p(e3) - 1 - r2 > 6) switch (d(e3, r2 + 1)) {
        case 109:
          if (45 !== d(e3, r2 + 4)) break;
        case 102:
          return l(e3, /(.+:)(.+)-([^]+)/, "$1-webkit-$2-$3$1-moz-" + (108 == d(e3, r2 + 3) ? "$3" : "$2-$3")) + e3;
        case 115:
          return ~u(e3, "stretch") ? W(l(e3, "stretch", "fill-available"), r2) + e3 : e3;
      }
      break;
    case 4949:
      if (115 !== d(e3, r2 + 1)) break;
    case 6444:
      switch (d(e3, p(e3) - 3 - (~u(e3, "!important") && 10))) {
        case 107:
          return l(e3, ":", ":" + o) + e3;
        case 101:
          return l(e3, /(.+:)([^;!]+)(;|!.+)?/, "$1" + o + (45 === d(e3, 14) ? "inline-" : "") + "box$3$1" + o + "$2$3$1" + t + "$2box$3") + e3;
      }
      break;
    case 5936:
      switch (d(e3, r2 + 11)) {
        case 114:
          return o + e3 + t + l(e3, /[svh]\w+-[tblr]{2}/, "tb") + e3;
        case 108:
          return o + e3 + t + l(e3, /[svh]\w+-[tblr]{2}/, "tb-rl") + e3;
        case 45:
          return o + e3 + t + l(e3, /[svh]\w+-[tblr]{2}/, "lr") + e3;
      }
      return o + e3 + t + e3 + e3;
  }
  return e3;
}
function L(e3, r2) {
  for (var n2 = "", t2 = h(e3), o2 = 0; o2 < t2; o2++) n2 += r2(e3[o2], o2, e3, r2) || "";
  return n2;
}
function U(e3, r2, n2, t2) {
  switch (e3.type) {
    case "@import":
    case "decl":
      return e3.return = e3.return || e3.value;
    case "comm":
      return "";
    case "@keyframes":
      return e3.return = e3.value + "{" + L(e3.children, t2) + "}";
    case "rule":
      e3.value = e3.props.join(",");
  }
  return p(n2 = L(e3.children, t2)) ? e3.return = e3.value + "{" + n2 + "}" : "";
}
function B(e3) {
  var r2 = /* @__PURE__ */ Object.create(null);
  return function(n2) {
    return void 0 === r2[n2] && (r2[n2] = e3(n2)), r2[n2];
  };
}
var F = function(e3, r2, n2) {
  for (var t2 = 0, o2 = 0; t2 = o2, o2 = _(), 38 === t2 && 12 === o2 && (r2[n2] = 1), !$(o2); ) O();
  return A(e3, b);
};
var H = /* @__PURE__ */ new WeakMap();
var J = function(e3) {
  if ("rule" === e3.type && e3.parent && !(e3.length < 1)) {
    for (var r2 = e3.value, n2 = e3.parent, t2 = e3.column === n2.column && e3.line === n2.line; "rule" !== n2.type; ) if (!(n2 = n2.parent)) return;
    if ((1 !== e3.props.length || 58 === r2.charCodeAt(0) || H.get(n2)) && !t2) {
      H.set(e3, true);
      for (var o2 = [], a2 = (function(e4, r3) {
        return D((function(e5, r4) {
          var n3 = -1, t3 = 44;
          do {
            switch ($(t3)) {
              case 0:
                38 === t3 && 12 === _() && (r4[n3] = 1), e5[n3] += F(b - 1, r4, n3);
                break;
              case 2:
                e5[n3] += V(t3);
                break;
              case 4:
                if (44 === t3) {
                  e5[++n3] = 58 === _() ? "&\f" : "", r4[n3] = e5[n3].length;
                  break;
                }
              default:
                e5[n3] += i(t3);
            }
          } while (t3 = O());
          return e5;
        })(S(e4), r3));
      })(r2, o2), s2 = n2.props, c2 = 0, l2 = 0; c2 < a2.length; c2++) for (var u2 = 0; u2 < s2.length; u2++, l2++) e3.props[l2] = o2[c2] ? a2[c2].replace(/&\f/g, s2[u2]) : s2[u2] + " " + a2[c2];
    }
  }
};
var K = function(e3) {
  if ("decl" === e3.type) {
    var r2 = e3.value;
    108 === r2.charCodeAt(0) && 98 === r2.charCodeAt(2) && (e3.return = "", e3.value = "");
  }
};
var Z = function(e3) {
  return "comm" === e3.type && e3.children.indexOf("emotion-disable-server-rendering-unsafe-selector-warning-please-do-not-use-this-the-warning-exists-for-a-reason") > -1;
};
var Q = function(e3) {
  return 105 === e3.type.charCodeAt(1) && 64 === e3.type.charCodeAt(0);
};
var X = function(e3) {
  e3.type = "", e3.value = "", e3.return = "", e3.children = "", e3.props = "";
};
var ee = function(e3, r2, n2) {
  Q(e3) && (e3.parent ? (console.error("`@import` rules can't be nested inside other rules. Please move it to the top level and put it before regular rules. Keep in mind that they can only be used within global styles."), X(e3)) : (function(e4, r3) {
    for (var n3 = e4 - 1; n3 >= 0; n3--) if (!Q(r3[n3])) return true;
    return false;
  })(r2, n2) && (console.error("`@import` rules can't be after other rules. Please put your `@import` rules before your other rules."), X(e3)));
};
var re = [function(e3, r2, n2, a2) {
  if (e3.length > -1 && !e3.return) switch (e3.type) {
    case "decl":
      e3.return = W(e3.value, e3.length);
      break;
    case "@keyframes":
      return L([x(e3, { value: l(e3.value, "@", "@" + o) })], a2);
    case "rule":
      if (e3.length) return (function(e4, r3) {
        return e4.map(r3).join("");
      })(e3.props, function(r3) {
        switch ((function(e4, r4) {
          return (e4 = /(::plac\w+|:read-\w+)/.exec(e4)) ? e4[0] : e4;
        })(r3)) {
          case ":read-only":
          case ":read-write":
            return L([x(e3, { props: [l(r3, /:(read-\w+)/, ":-moz-$1")] })], a2);
          case "::placeholder":
            return L([x(e3, { props: [l(r3, /:(plac\w+)/, ":-webkit-input-$1")] }), x(e3, { props: [l(r3, /:(plac\w+)/, ":-moz-$1")] }), x(e3, { props: [l(r3, /:(plac\w+)/, t + "input-$1")] })], a2);
        }
        return "";
      });
  }
}];
var ne = { animationIterationCount: 1, borderImageOutset: 1, borderImageSlice: 1, borderImageWidth: 1, boxFlex: 1, boxFlexGroup: 1, boxOrdinalGroup: 1, columnCount: 1, columns: 1, flex: 1, flexGrow: 1, flexPositive: 1, flexShrink: 1, flexNegative: 1, flexOrder: 1, gridRow: 1, gridRowEnd: 1, gridRowSpan: 1, gridRowStart: 1, gridColumn: 1, gridColumnEnd: 1, gridColumnSpan: 1, gridColumnStart: 1, msGridRow: 1, msGridRowSpan: 1, msGridColumn: 1, msGridColumnSpan: 1, fontWeight: 1, lineHeight: 1, opacity: 1, order: 1, orphans: 1, tabSize: 1, widows: 1, zIndex: 1, zoom: 1, WebkitLineClamp: 1, fillOpacity: 1, floodOpacity: 1, stopOpacity: 1, strokeDasharray: 1, strokeDashoffset: 1, strokeMiterlimit: 1, strokeOpacity: 1, strokeWidth: 1 };
var te = `You have illegal escape sequence in your template literal, most likely inside content's property value.
Because you write your CSS inside a JavaScript string you actually have to do double escaping, so for example "content: '\\00d7';" should become "content: '\\\\00d7';".
You can read more about this here:
https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#ES2018_revision_of_illegal_escape_sequences`;
var oe = /[A-Z]|^ms/g;
var ae = /_EMO_([^_]+?)_([^]*?)_EMO_/g;
var ie = function(e3) {
  return 45 === e3.charCodeAt(1);
};
var se = function(e3) {
  return null != e3 && "boolean" != typeof e3;
};
var ce = B(function(e3) {
  return ie(e3) ? e3 : e3.replace(oe, "-$&").toLowerCase();
});
var le = function(e3, r2) {
  switch (e3) {
    case "animation":
    case "animationName":
      if ("string" == typeof r2) return r2.replace(ae, function(e4, r3, n2) {
        return be = { name: r3, styles: n2, next: be }, r3;
      });
  }
  return 1 === ne[e3] || ie(e3) || "number" != typeof r2 || 0 === r2 ? r2 : r2 + "px";
};
if (true) {
  ue = /(var|attr|counters?|url|(((repeating-)?(linear|radial))|conic)-gradient)\(|(no-)?(open|close)-quote/, de = ["normal", "none", "initial", "inherit", "unset"], fe = le, pe = /^-ms-/, he = /-(.)/g, ve = {};
  le = function(e3, r2) {
    if ("content" === e3 && ("string" != typeof r2 || -1 === de.indexOf(r2) && !ue.test(r2) && (r2.charAt(0) !== r2.charAt(r2.length - 1) || '"' !== r2.charAt(0) && "'" !== r2.charAt(0)))) throw new Error("You seem to be using a value for 'content' without quotes, try replacing it with `content: '\"" + r2 + "\"'`");
    var n2 = fe(e3, r2);
    return "" === n2 || ie(e3) || -1 === e3.indexOf("-") || void 0 !== ve[e3] || (ve[e3] = true, console.error("Using kebab-case for css properties in objects is not supported. Did you mean " + e3.replace(pe, "ms-").replace(he, function(e4, r3) {
      return r3.toUpperCase();
    }) + "?")), n2;
  };
}
var ue;
var de;
var fe;
var pe;
var he;
var ve;
var me = "Component selectors can only be used in conjunction with @emotion/babel-plugin, the swc Emotion plugin, or another Emotion-aware compiler transform.";
function ge(e3, r2, n2) {
  if (null == n2) return "";
  if (void 0 !== n2.__emotion_styles) {
    if ("NO_COMPONENT_SELECTOR" === n2.toString()) throw new Error(me);
    return n2;
  }
  switch (typeof n2) {
    case "boolean":
      return "";
    case "object":
      if (1 === n2.anim) return be = { name: n2.name, styles: n2.styles, next: be }, n2.name;
      if (void 0 !== n2.styles) {
        var t2 = n2.next;
        if (void 0 !== t2) for (; void 0 !== t2; ) be = { name: t2.name, styles: t2.styles, next: be }, t2 = t2.next;
        var o2 = n2.styles + ";";
        return void 0 !== n2.map && (o2 += n2.map), o2;
      }
      return (function(e4, r3, n3) {
        var t3 = "";
        if (Array.isArray(n3)) for (var o3 = 0; o3 < n3.length; o3++) t3 += ge(e4, r3, n3[o3]) + ";";
        else for (var a3 in n3) {
          var i3 = n3[a3];
          if ("object" != typeof i3) null != r3 && void 0 !== r3[i3] ? t3 += a3 + "{" + r3[i3] + "}" : se(i3) && (t3 += ce(a3) + ":" + le(a3, i3) + ";");
          else {
            if ("NO_COMPONENT_SELECTOR" === a3 && true) throw new Error(me);
            if (!Array.isArray(i3) || "string" != typeof i3[0] || null != r3 && void 0 !== r3[i3[0]]) {
              var s3 = ge(e4, r3, i3);
              switch (a3) {
                case "animation":
                case "animationName":
                  t3 += ce(a3) + ":" + s3 + ";";
                  break;
                default:
                  "undefined" === a3 && console.error("You have passed in falsy value as style object's key (can happen when in example you pass unexported component as computed key)."), t3 += a3 + "{" + s3 + "}";
              }
            } else for (var c3 = 0; c3 < i3.length; c3++) se(i3[c3]) && (t3 += ce(a3) + ":" + le(a3, i3[c3]) + ";");
          }
        }
        return t3;
      })(e3, r2, n2);
    case "function":
      if (void 0 !== e3) {
        var a2 = be, i2 = n2(e3);
        return be = a2, ge(e3, r2, i2);
      }
      console.error("Functions that are interpolated in css calls will be stringified.\nIf you want to have a css call based on props, create a function that returns a css call like this\nlet dynamicStyle = (props) => css`color: ${props.color}`\nIt can be called directly with props or interpolated in a styled call like this\nlet SomeComponent = styled('div')`${dynamicStyle}`");
      break;
    case "string":
      if (true) {
        var s2 = [], c2 = n2.replace(ae, function(e4, r3, n3) {
          var t3 = "animation" + s2.length;
          return s2.push("const " + t3 + " = keyframes`" + n3.replace(/^@keyframes animation-\w+/, "") + "`"), "${" + t3 + "}";
        });
        s2.length && console.error("`keyframes` output got interpolated into plain string, please wrap it with `css`.\n\nInstead of doing this:\n\n" + [].concat(s2, ["`" + c2 + "`"]).join("\n") + "\n\nYou should wrap it with `css` like this:\n\ncss`" + c2 + "`");
      }
  }
  if (null == r2) return n2;
  var l2 = r2[n2];
  return void 0 !== l2 ? l2 : n2;
}
var ye;
var be;
var we = /label:\s*([^\s;\n{]+)\s*(;|$)/g;
ye = /\/\*#\ssourceMappingURL=data:application\/json;\S+\s+\*\//g;
var ke = function(e3, r2, n2) {
  if (1 === e3.length && "object" == typeof e3[0] && null !== e3[0] && void 0 !== e3[0].styles) return e3[0];
  var t2 = true, o2 = "";
  be = void 0;
  var a2, i2 = e3[0];
  null == i2 || void 0 === i2.raw ? (t2 = false, o2 += ge(n2, r2, i2)) : (void 0 === i2[0] && console.error(te), o2 += i2[0]);
  for (var s2 = 1; s2 < e3.length; s2++) o2 += ge(n2, r2, e3[s2]), t2 && (void 0 === i2[s2] && console.error(te), o2 += i2[s2]);
  o2 = o2.replace(ye, function(e4) {
    return a2 = e4, "";
  }), we.lastIndex = 0;
  for (var c2, l2 = ""; null !== (c2 = we.exec(o2)); ) l2 += "-" + c2[1];
  var u2 = (function(e4) {
    for (var r3, n3 = 0, t3 = 0, o3 = e4.length; o3 >= 4; ++t3, o3 -= 4) r3 = 1540483477 * (65535 & (r3 = 255 & e4.charCodeAt(t3) | (255 & e4.charCodeAt(++t3)) << 8 | (255 & e4.charCodeAt(++t3)) << 16 | (255 & e4.charCodeAt(++t3)) << 24)) + (59797 * (r3 >>> 16) << 16), n3 = 1540483477 * (65535 & (r3 ^= r3 >>> 24)) + (59797 * (r3 >>> 16) << 16) ^ 1540483477 * (65535 & n3) + (59797 * (n3 >>> 16) << 16);
    switch (o3) {
      case 3:
        n3 ^= (255 & e4.charCodeAt(t3 + 2)) << 16;
      case 2:
        n3 ^= (255 & e4.charCodeAt(t3 + 1)) << 8;
      case 1:
        n3 = 1540483477 * (65535 & (n3 ^= 255 & e4.charCodeAt(t3))) + (59797 * (n3 >>> 16) << 16);
    }
    return (((n3 = 1540483477 * (65535 & (n3 ^= n3 >>> 13)) + (59797 * (n3 >>> 16) << 16)) ^ n3 >>> 15) >>> 0).toString(36);
  })(o2) + l2;
  return true ? { name: u2, styles: o2, map: a2, next: be, toString: function() {
    return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop).";
  } } : { name: u2, styles: o2, next: be };
};
function Ee(e3, r2, n2) {
  var t2 = "";
  return n2.split(" ").forEach(function(n3) {
    void 0 !== e3[n3] ? r2.push(e3[n3] + ";") : t2 += n3 + " ";
  }), t2;
}
var xe = function(e3, r2, n2) {
  !(function(e4, r3, n3) {
    var t3 = e4.key + "-" + r3.name;
    false === n3 && void 0 === e4.registered[t3] && (e4.registered[t3] = r3.styles);
  })(e3, r2, n2);
  var t2 = e3.key + "-" + r2.name;
  if (void 0 === e3.inserted[r2.name]) {
    var o2 = r2;
    do {
      e3.insert(r2 === o2 ? "." + t2 : "", o2, e3.sheet, true), o2 = o2.next;
    } while (void 0 !== o2);
  }
};
function Ne(e3, r2) {
  if (void 0 === e3.inserted[r2.name]) return e3.insert("", r2, e3.sheet, true);
}
function Oe(e3, r2, n2) {
  var t2 = [], o2 = Ee(e3, t2, n2);
  return t2.length < 2 ? n2 : o2 + r2(t2);
}
var _e;
var Ce;
var Ae;
var $e;
var Se;
var De = function e2(r2) {
  for (var n2 = "", t2 = 0; t2 < r2.length; t2++) {
    var o2 = r2[t2];
    if (null != o2) {
      var a2 = void 0;
      switch (typeof o2) {
        case "boolean":
          break;
        case "object":
          if (Array.isArray(o2)) a2 = e2(o2);
          else for (var i2 in a2 = "", o2) o2[i2] && i2 && (a2 && (a2 += " "), a2 += i2);
          break;
        default:
          a2 = o2;
      }
      a2 && (n2 && (n2 += " "), n2 += a2);
    }
  }
  return n2;
};
var Ve = (function(e3) {
  var r2 = (function(e4) {
    var r3 = e4.key;
    if (!r3) throw new Error("You have to configure `key` for your cache. Please make sure it's unique (and not equal to 'css') as it's used for linking styles to your cache.\nIf multiple caches share the same key they might \"fight\" for each other's style elements.");
    if ("css" === r3) {
      var t3 = document.querySelectorAll("style[data-emotion]:not([data-s])");
      Array.prototype.forEach.call(t3, function(e5) {
        -1 !== e5.getAttribute("data-emotion").indexOf(" ") && (document.head.appendChild(e5), e5.setAttribute("data-s", ""));
      });
    }
    var o2 = e4.stylisPlugins || re;
    if (/[^a-z-]/.test(r3)) throw new Error('Emotion key must only contain lower case alphabetical characters and - but "' + r3 + '" was passed');
    var a2, i2, s2 = {}, c2 = [];
    a2 = e4.container || document.head, Array.prototype.forEach.call(document.querySelectorAll('style[data-emotion^="' + r3 + ' "]'), function(e5) {
      for (var r4 = e5.getAttribute("data-emotion").split(" "), n2 = 1; n2 < r4.length; n2++) s2[r4[n2]] = true;
      c2.push(e5);
    });
    var l2 = [J, K];
    l2.push(/* @__PURE__ */ (function(e5) {
      return function(r4, n2, t4) {
        if ("rule" === r4.type && !e5.compat) {
          var o3 = r4.value.match(/(:first|:nth|:nth-last)-child/g);
          if (o3) {
            for (var a3 = r4.parent === t4[0] ? t4[0].children : t4, i3 = a3.length - 1; i3 >= 0; i3--) {
              var s3 = a3[i3];
              if (s3.line < r4.line) break;
              if (s3.column < r4.column) {
                if (Z(s3)) return;
                break;
              }
            }
            o3.forEach(function(e6) {
              console.error('The pseudo class "' + e6 + '" is potentially unsafe when doing server-side rendering. Try changing it to "' + e6.split("-child")[0] + '-of-type".');
            });
          }
        }
      };
    })({ get compat() {
      return v2.compat;
    } }), ee);
    var u2, d2, f2 = [U, true ? function(e5) {
      e5.root || (e5.return ? u2.insert(e5.return) : e5.value && "comm" !== e5.type && u2.insert(e5.value + "{}"));
    } : (d2 = function(e5) {
      u2.insert(e5);
    }, function(e5) {
      e5.root || (e5 = e5.return) && d2(e5);
    })], p2 = (function(e5) {
      var r4 = h(e5);
      return function(n2, t4, o3, a3) {
        for (var i3 = "", s3 = 0; s3 < r4; s3++) i3 += e5[s3](n2, t4, o3, a3) || "";
        return i3;
      };
    })(l2.concat(o2, f2));
    i2 = function(e5, r4, n2, t4) {
      u2 = n2, void 0 !== r4.map && (u2 = { insert: function(e6) {
        n2.insert(e6 + r4.map);
      } }), L(T(e5 ? e5 + "{" + r4.styles + "}" : r4.styles), p2), t4 && (v2.inserted[r4.name] = true);
    };
    var v2 = { key: r3, sheet: new n({ key: r3, container: a2, nonce: e4.nonce, speedy: e4.speedy, prepend: e4.prepend, insertionPoint: e4.insertionPoint }), nonce: e4.nonce, inserted: s2, registered: {}, insert: i2 };
    return v2.sheet.hydrate(c2), v2;
  })({ key: "css" });
  r2.sheet.speedy = function(e4) {
    if (0 !== this.ctr) throw new Error("speedy must be changed before any rules are inserted");
    this.isSpeedy = e4;
  }, r2.compat = true;
  var t2 = function() {
    for (var e4 = arguments.length, n2 = new Array(e4), t3 = 0; t3 < e4; t3++) n2[t3] = arguments[t3];
    var o2 = ke(n2, r2.registered, void 0);
    return xe(r2, o2, false), r2.key + "-" + o2.name;
  };
  return { css: t2, cx: function() {
    for (var e4 = arguments.length, n2 = new Array(e4), o2 = 0; o2 < e4; o2++) n2[o2] = arguments[o2];
    return Oe(r2.registered, t2, De(n2));
  }, injectGlobal: function() {
    for (var e4 = arguments.length, n2 = new Array(e4), t3 = 0; t3 < e4; t3++) n2[t3] = arguments[t3];
    var o2 = ke(n2, r2.registered);
    Ne(r2, o2);
  }, keyframes: function() {
    for (var e4 = arguments.length, n2 = new Array(e4), t3 = 0; t3 < e4; t3++) n2[t3] = arguments[t3];
    var o2 = ke(n2, r2.registered), a2 = "animation-" + o2.name;
    return Ne(r2, { name: o2.name, styles: "@keyframes " + a2 + "{" + o2.styles + "}" }), a2;
  }, hydrate: function(e4) {
    e4.forEach(function(e5) {
      r2.inserted[e5] = true;
    });
  }, flush: function() {
    r2.registered = {}, r2.inserted = {}, r2.sheet.flush();
  }, sheet: r2.sheet, cache: r2, getRegisteredStyles: Ee.bind(null, r2.registered), merge: Oe.bind(null, r2.registered, t2) };
})();
var Ie = Ve.cx;
var Re = Ve.css;
var ze = Re(_e || (_e = r(["\n  content: '';\n  position: absolute;\n  top: 0;\n  height: var(--tree-line-height);\n  box-sizing: border-box;\n"])));
var je = Re(Ce || (Ce = r(["\n  display: flex;\n  padding-inline-start: 0;\n  margin: 0;\n  padding-top: var(--tree-line-height);\n  position: relative;\n\n  ::before {\n    ", ";\n    left: calc(50% - var(--tree-line-width) / 2);\n    width: 0;\n    border-left: var(--tree-line-width) var(--tree-node-line-style)\n      var(--tree-line-color);\n  }\n"])), ze);
var Pe = Re(Ae || (Ae = r(["\n  flex: auto;\n  text-align: center;\n  list-style-type: none;\n  position: relative;\n  padding: var(--tree-line-height) var(--tree-node-padding) 0\n    var(--tree-node-padding);\n"])));
var Te = Re($e || ($e = r(["\n  ::before,\n  ::after {\n    ", ";\n    right: 50%;\n    width: 50%;\n    border-top: var(--tree-line-width) var(--tree-node-line-style)\n      var(--tree-line-color);\n  }\n  ::after {\n    left: 50%;\n    border-left: var(--tree-line-width) var(--tree-node-line-style)\n      var(--tree-line-color);\n  }\n\n  :only-of-type {\n    padding: 0;\n    ::after,\n    :before {\n      display: none;\n    }\n  }\n\n  :first-of-type {\n    ::before {\n      border: 0 none;\n    }\n    ::after {\n      border-radius: var(--tree-line-border-radius) 0 0 0;\n    }\n  }\n\n  :last-of-type {\n    ::before {\n      border-right: var(--tree-line-width) var(--tree-node-line-style)\n        var(--tree-line-color);\n      border-radius: 0 var(--tree-line-border-radius) 0 0;\n    }\n    ::after {\n      border: 0 none;\n    }\n  }\n"])), ze);
function qe(r2) {
  var n2 = r2.children, t2 = r2.label;
  return e.createElement("li", { className: Ie(Pe, Te, r2.className) }, t2, e.Children.count(n2) > 0 && e.createElement("ul", { className: je }, n2));
}
function Ge(n2) {
  var t2 = n2.children, o2 = n2.label, a2 = n2.lineHeight, i2 = void 0 === a2 ? "20px" : a2, s2 = n2.lineWidth, c2 = void 0 === s2 ? "1px" : s2, l2 = n2.lineColor, u2 = void 0 === l2 ? "black" : l2, d2 = n2.nodePadding, f2 = void 0 === d2 ? "5px" : d2, p2 = n2.lineStyle, h2 = void 0 === p2 ? "solid" : p2, v2 = n2.lineBorderRadius, m2 = void 0 === v2 ? "5px" : v2;
  return e.createElement("ul", { className: Re(Se || (Se = r(["\n        padding-inline-start: 0;\n        margin: 0;\n        display: flex;\n\n        --line-height: ", ";\n        --line-width: ", ";\n        --line-color: ", ";\n        --line-border-radius: ", ";\n        --line-style: ", ";\n        --node-padding: ", ";\n\n        --tree-line-height: var(--line-height, 20px);\n        --tree-line-width: var(--line-width, 1px);\n        --tree-line-color: var(--line-color, black);\n        --tree-line-border-radius: var(--line-border-radius, 5px);\n        --tree-node-line-style: var(--line-style, solid);\n        --tree-node-padding: var(--node-padding, 5px);\n      "])), i2, c2, u2, m2, h2, f2) }, e.createElement(qe, { label: o2 }, t2));
}
export {
  Ge as Tree,
  qe as TreeNode
};
//# sourceMappingURL=react-organizational-chart.js.map
