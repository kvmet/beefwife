#!/usr/bin/env bb

;; The kipple gate.
;;
;; Kipple is Dick's word for the useless matter that accumulates when nobody is
;; looking, and which reproduces itself: files drift long, typography creeps in,
;; links rot, indexes fall behind. None of it is a bug, so nothing else will ever
;; fail because of it, which is exactly why it needs a gate.
;;
;; Walks the given paths (default: the whole project), drops the ignored set, and
;; composes the check libraries: `length` (per-file-type line budgets), `taste`
;; (banned typography), and `links` (relative Markdown links resolve). Each
;; returns result maps; this file only orchestrates and decides the exit code.
;;
;;   bb bb/kipple.clj           ; scan from the current directory
;;   bb bb/kipple.clj ./        ; same
;;   bb bb/kipple.clj src docs  ; scan specific subtrees

(ns kipple
  (:require [babashka.fs :as fs]
            [clojure.java.io :as io]
            [clojure.string :as str]
            [length]
            [taste]
            [links]))

;; Directories and files to skip entirely. A name here ignores the file, or
;; everything nested inside the directory. Every skip is counted and named in the
;; summary line: an ignore rule that quietly swallows real source is worse than
;; no gate at all, so the report always says what it dropped.
(def ignored
  #{;; version control, editor and tool caches
    ".git" ".jj" ".hg" ".svn"
    ".clj-kondo" ".lsp" ".cpcache" ".shadow-cljs"
    ".pytest_cache" ".mypy_cache" ".ruff_cache" "__pycache__"
    ".gradle" ".terraform" ".idea" ".vscode" ".DS_Store"
    ;; dependency trees and build output
    "node_modules" "vendor" ".venv" "venv" "Pods"
    "target" "build" "dist" "out" ".next" ".nuxt" "coverage"
    ;; generated manifests: authored by a tool, not by a person
    "Cargo.lock" "package-lock.json" "yarn.lock" "pnpm-lock.yaml"
    "poetry.lock" "uv.lock" "Gemfile.lock" "go.sum" "flake.lock"
    "Manifest.toml"
    ;; deliberately unmaintained
    "sandbox"          ; throwaway exploration scripts, not part of the package
    "archive"})        ; frozen superseded docs, kept for reference

;; Length rules, tried top to bottom; the first match wins.
;; :exts  - file extensions the rule covers (no leading dot)
;; :under - optional path component that must be present (e.g. "docs")
;; :warn / :fail - line thresholds
;;
;; The numbers encode a judgement about each format, not one uniform budget: a
;; doc that needs 300 lines is two docs, a 400-line shell script is a program in
;; the wrong language, and a Rust or C file legitimately runs longer than a
;; TypeScript component. Both messages point at splitting the file, never at
;; shaving lines to fit.
(def rules
  [{:exts #{"md" "rst" "adoc"} :under "docs" :warn 200 :fail 300}
   {:exts #{"md" "rst" "adoc" "txt"}         :warn 300 :fail 600}
   {:exts #{"sh" "bash" "zsh" "fish" "nix"}  :warn 200 :fail 400}
   {:exts #{"toml" "ini" "cfg"}              :warn 150 :fail 300}
   {:exts #{"yaml" "yml" "edn" "sql"}        :warn 200 :fail 500}
   {:exts #{"ts" "tsx" "js" "jsx" "mjs" "cjs"
            "vue" "svelte" "html"}           :warn 500 :fail 600}
   {:exts #{"css" "scss" "sass" "less"}      :warn 400 :fail 800}
   {:exts #{"clj" "cljs" "cljc" "py" "rb" "go" "java" "kt" "cs"
            "swift" "ex" "exs" "erl" "lua" "hs" "scala"} :warn 400 :fail 800}
   {:exts #{"jl" "rs" "zig" "c" "h" "cpp" "hpp" "cc" "hh" "m" "mm"}
    :warn 500 :fail 900}])

(defn- components [path]
  (set (map str (fs/components path))))

(defn ignore-reason
  "The ignored name that excludes this path, or nil to keep it."
  [path]
  (or (some ignored (components path))
      ;; throwaway scratch files
      (when (str/starts-with? (str (fs/file-name path)) "scratch_") "scratch_*")))

(defn rule-for [path]
  (let [ext   (fs/extension path)
        comps (components path)]
    (first (filter (fn [{:keys [exts under]}]
                     (and (contains? exts ext)
                          (or (nil? under) (contains? comps under))))
                   rules))))

(defn walk
  "Every regular file under root, with ignored directories pruned rather than
  filtered afterward. Returns [files pruned], where pruned is the set of ignore
  names that matched, so the report can say what was dropped.

  Deliberately not fs/glob: glob skips hidden paths, which would silently exempt
  .agents, .github and every other dotted directory from the whole gate.
  Symlinks are skipped because their target is either already in the walk or
  outside the project."
  [root]
  (let [files  (volatile! [])
        pruned (volatile! #{})
        note   (fn [reason] (vswap! pruned conj reason) nil)]
    (if (fs/directory? root)
      (fs/walk-file-tree
       root
       {:pre-visit-dir (fn [dir _]
                         (if-let [reason (ignore-reason dir)]
                           (do (note reason) :skip-subtree)
                           :continue))
        :visit-file    (fn [file _]
                         (cond
                           (fs/sym-link? file)         nil
                           (ignore-reason file)        (note (ignore-reason file))
                           :else                       (vswap! files conj file))
                         :continue)})
      (vswap! files conj (fs/path root)))
    [@files @pruned]))

(defn- failed [results] (filter #(= :fail (:status %)) results))

(defn- generated? [path]
  (try
    (with-open [reader (io/reader (str path))]
      (str/includes? (or (.readLine reader) "") "Generated from"))
    (catch Exception _ false)))

(let [args           *command-line-args*
      roots          (if (empty? args) ["."] args)
      walked         (map walk roots)
      files          (mapcat first walked)
      skipped        (reduce into #{} (map second walked))
      length-results (keep (fn [f]
                             (when-not (generated? f)
                               (when-let [{:keys [warn fail]} (rule-for f)]
                                 (length/check-file f warn fail))))
                           files)
      taste-results  (taste/check-paths files)
      link-results   (links/check-paths files)
      over-budget    (failed length-results)
      warns          (filter #(= :warn (:status %)) length-results)
      taste-bad      (failed taste-results)
      link-bad       (failed link-results)
      taste-count    (reduce + 0 (map (comp count :hits) taste-results))
      link-count     (reduce + 0 (map (comp count :hits) link-results))]

  (run! length/report length-results)
  (run! taste/report taste-results)
  (run! links/report link-results)
  (println (str "\n"
                (count files) " checked, "
                (count over-budget) " over budget, "
                (count warns) " warning(s), "
                taste-count " typography, "
                link-count " broken link(s)"
                (when (seq skipped)
                  (str "\nignored: " (str/join ", " (sort skipped))))))

  (when (some seq [over-budget taste-bad link-bad])
    (System/exit 1)))
