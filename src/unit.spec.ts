import { emitCss } from "./emit"
import { flattenForContext } from "./collapse"
import { aliasTarget, resolveReferences } from "./resolve"
import { serializeValue } from "./serialize"
import { cssNames, nameFromPath, pathToKebabName, usesExportNames } from "./name"
import { DEFAULT_NAME_EXTENSION } from "./defaults"
import type { ResolvedCssOptions } from "./options"
import type { DtcgNode, FlatToken } from "./types"

const OPTS: ResolvedCssOptions = {
  contexts: { $root: ":root", dark: ".dark", light: ".light" },
  colorFormat: "oklch",
  dimensionUnit: "preserve",
  nameExtension: DEFAULT_NAME_EXTENSION,
  includeAll: false,
}

describe("flattenForContext", () => {
  const tree: DtcgNode = {
    c: {
      a: {
        dark: { $value: "darkVal" },
        $root: { $value: "rootVal" },
        $type: "color",
      },
      b: {
        $root: { $value: "onlyRoot" },
        $type: "color",
      },
    },
  }

  it("picks the context value when present", () => {
    expect(flattenForContext(tree, "dark").get("c.a")?.value).toBe("darkVal")
  })

  it("falls back to $root when the context is missing", () => {
    expect(flattenForContext(tree, "dark").get("c.b")?.value).toBe("onlyRoot")
    expect(flattenForContext(tree, "light").get("c.a")?.value).toBe("rootVal")
  })

  it("uses dot-paths and strips the context layer", () => {
    const flat = flattenForContext(tree, "$root")
    expect([...flat.keys()].sort()).toEqual(["c.a", "c.b"])
  })

  it("inherits $type and carries extensions", () => {
    const t = flattenForContext(tree, "$root").get("c.a")
    expect(t?.type).toBe("color")
  })
})

describe("resolveReferences", () => {
  it("follows multi-hop aliases", () => {
    const map = new Map<string, FlatToken>([
      ["a", { path: "a", value: "{b}" }],
      ["b", { path: "b", value: "{c}" }],
      ["c", { path: "c", value: "leaf" }],
    ])
    resolveReferences(map)
    expect(map.get("a")?.value).toBe("leaf")
  })

  it("throws on a cycle", () => {
    const map = new Map<string, FlatToken>([
      ["a", { path: "a", value: "{b}" }],
      ["b", { path: "b", value: "{a}" }],
    ])
    expect(() => resolveReferences(map)).toThrow(/circular/)
  })

  it("throws on an unresolved reference", () => {
    const map = new Map<string, FlatToken>([["a", { path: "a", value: "{missing}" }]])
    expect(() => resolveReferences(map)).toThrow(/unresolved/)
  })

  it("detects whole-value aliases only", () => {
    expect(aliasTarget("{a.b.c}")).toBe("a.b.c")
    expect(aliasTarget("plain")).toBeNull()
  })
})

describe("serializeValue", () => {
  it("serializes oklch colors and omits alpha when 1", () => {
    expect(serializeValue({ colorSpace: "oklch", components: [0.8, 0.18, 151.7], alpha: 1 }, OPTS)).toBe(
      "oklch(0.8 0.18 151.7)",
    )
  })

  it("includes alpha when < 1", () => {
    expect(serializeValue({ colorSpace: "oklch", components: [0.5, 0.1, 200], alpha: 0.5 }, OPTS)).toBe(
      "oklch(0.5 0.1 200 / 0.5)",
    )
  })

  it("honors hex color format", () => {
    expect(
      serializeValue(
        { colorSpace: "oklch", components: [0.8, 0.18, 151.7], hex: "#4ADE80" },
        { ...OPTS, colorFormat: "hex" },
      ),
    ).toBe("#4ade80")
  })

  it("serializes dimensions, preserving and converting units", () => {
    expect(serializeValue({ value: 14, unit: "px" }, OPTS)).toBe("14px")
    expect(serializeValue({ value: 16, unit: "px" }, { ...OPTS, dimensionUnit: "rem" })).toBe("1rem")
  })

  it("serializes font families with quoting", () => {
    expect(serializeValue(["Geist Variable", "sans-serif"], OPTS)).toBe('"Geist Variable", sans-serif')
  })

  it("serializes plain numbers", () => {
    expect(serializeValue(1.6, OPTS)).toBe("1.6")
  })
})

describe("naming", () => {
  const exported: FlatToken = {
    path: "base.color.neutral.foreground",
    value: "x",
    extensions: { [DEFAULT_NAME_EXTENSION]: { exportName: ["foreground", "card-foreground", ""] } },
  }

  it("fans out multiple export names and drops empties", () => {
    expect(cssNames(exported, DEFAULT_NAME_EXTENSION, true)).toEqual(["foreground", "card-foreground"])
  })

  it("emits nothing for a token without export names in exportName mode", () => {
    expect(cssNames({ path: "base.color.green.500", value: "x" }, DEFAULT_NAME_EXTENSION, true)).toEqual([])
  })

  it("derives from path in fallback mode", () => {
    expect(nameFromPath("semantic.color.primary.default")).toBe("color-primary")
    expect(nameFromPath("base.color.green.500")).toBe("color-green-500")
  })

  it("detects exportName usage", () => {
    expect(usesExportNames([exported], DEFAULT_NAME_EXTENSION)).toBe(true)
    expect(usesExportNames([{ path: "a", value: "x" }], DEFAULT_NAME_EXTENSION)).toBe(false)
  })

  it("kebab-cases the full path for generated names", () => {
    expect(pathToKebabName("base.color.primary.500")).toBe("base-color-primary-500")
    expect(pathToKebabName("semantic.color.primary.default")).toBe("semantic-color-primary-default")
    expect(pathToKebabName("base.typography.fontFamily.sans")).toBe("base-typography-font-family-sans")
    expect(pathToKebabName("base.spacing.2xl")).toBe("base-spacing-2xl")
    expect(pathToKebabName("base.Color Scale.Brand_Blue")).toBe("base-color-scale-brand-blue")
  })
})

describe("includeAll", () => {
  const ext = (...names: string[]) => ({ [DEFAULT_NAME_EXTENSION]: { exportName: names } })
  const tree: DtcgNode = {
    base: {
      color: {
        red: { $root: { $value: "red" }, $type: "color" },
        blue: { $root: { $value: "blue" }, $type: "color" },
      },
    },
    semantic: {
      color: {
        primary: {
          $root: { $value: "{base.color.blue}" },
          $type: "color",
          $extensions: ext("primary"),
        },
      },
    },
  }

  it("emits only export-named tokens by default", () => {
    const css = emitCss(tree, OPTS)
    expect(css).toContain("--primary: blue;")
    expect(css).not.toContain("--base-color-red")
    expect(css).not.toContain("--base-color-blue")
  })

  it("also emits kebab-cased path variables for unnamed tokens when set", () => {
    const css = emitCss(tree, { ...OPTS, includeAll: true })
    expect(css).toContain("--primary: blue;")
    expect(css).toContain("--base-color-red: red;")
    expect(css).toContain("--base-color-blue: blue;")
    // A token with an export name is not duplicated under its path.
    expect(css).not.toContain("--semantic-color-primary")
  })

  it("lets an export name win over a generated path name", () => {
    const clash: DtcgNode = {
      ...tree,
      semantic: {
        color: {
          primary: {
            $root: { $value: "{base.color.blue}" },
            $type: "color",
            $extensions: ext("base-color-red"),
          },
        },
      },
    }
    const css = emitCss(clash, { ...OPTS, includeAll: true })
    expect(css).toContain("--base-color-red: blue;")
    expect(css).not.toContain("--base-color-red: red;")
    expect(css).toContain("--base-color-blue: blue;")
  })

  it("leaves output unchanged when no token declares an exportName", () => {
    const plain: DtcgNode = {
      base: { color: { red: { $root: { $value: "red" }, $type: "color" } } },
    }
    expect(emitCss(plain, { ...OPTS, includeAll: true })).toBe(emitCss(plain, OPTS))
    expect(emitCss(plain, OPTS)).toContain("--color-red: red;")
  })
})
