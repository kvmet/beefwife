#!/usr/bin/env bb

;; Pure taste checker: the project's typography rules. Prose is plain ASCII
;; punctuation, so a small set of characters is banned outright:
;;   - em dash and en dash (U+2014 / U+2013)
;;   - curly quotes (U+2018 U+2019 U+201C U+201D): use ASCII ' and "
;;   - non-breaking space (U+00A0) and zero-width spaces (U+200B / U+FEFF)
;; Math and symbol unicode (the greek letters, the arrows, the U+2212 minus) is
;; fine and deliberately NOT listed: this is a blocklist of typographic artifacts,
;; not an ASCII-only rule.
;;
;; Usable two ways, mirroring `length`:
;;   - standalone:  bb bb/taste.clj <file-or-dir>...
;;   - as a library: (require '[taste]) and call `check-file` / `check-paths`,
;;     which return result maps instead of printing.

(ns taste
  (:require [babashka.fs :as fs]
            [clojure.string :as str]))

;; Each banned character mapped to a short label for the report. Built from code
;; points so this file itself holds none of them.
(def banned
  (into {} (map (fn [[cp label]] [(char cp) label]))
        [[0x2014 "em dash"]
         [0x2013 "en dash"]
         [0x2018 "curly quote"]
         [0x2019 "curly quote"]
         [0x201C "curly quote"]
         [0x201D "curly quote"]
         [0x00A0 "non-breaking space"]
         [0x200B "zero-width space"]
         [0xFEFF "zero-width no-break space"]]))

(defn- line-kinds
  "Distinct labels of banned characters present in a line, in first-seen order."
  [line]
  (->> line (keep banned) distinct vec))

(defn check-file
  "Scan one file for banned typography.
  Returns {:status :ok|:fail|:skip :path s :hits [{:line n :text s :kinds [...]}]}.
  Unreadable files (binary, permissions, ...) come back as :skip."
  [path]
  (try
    (let [hits (->> (fs/read-all-lines path)
                    (map-indexed (fn [i line]
                                   (let [kinds (line-kinds line)]
                                     (when (seq kinds)
                                       {:line (inc i) :text (str/trim line) :kinds kinds}))))
                    (remove nil?)
                    vec)]
      {:status (if (seq hits) :fail :ok) :path (str path) :hits hits})
    (catch Exception _
      {:status :skip :path (str path)})))

(defn check-paths
  "Check many paths (files only) for banned typography."
  [paths]
  (map check-file paths))

(defn report
  "Print one line per offending line. :ok and :skip are silent."
  [{:keys [status path hits]}]
  (when (= :fail status)
    (doseq [{:keys [line text kinds]} hits]
      (println (str "TASTE: " path ":" line ": " (str/join ", " kinds) " banned: " text)))))

(defn- expand [arg]
  (if (fs/directory? arg)
    (filter fs/regular-file? (fs/glob arg "**"))
    [(fs/path arg)]))

(defn -main [args]
  (when (empty? args)
    (println "Usage: bb bb/taste.clj <file-or-dir>...")
    (System/exit 1))
  (let [results (check-paths (mapcat expand args))
        fails   (filter #(= :fail (:status %)) results)]
    (run! report results)
    (when (seq fails)
      (System/exit 1))))

;; Run the CLI only when invoked directly, not when required as a library.
(when (= *file* (System/getProperty "babashka.file"))
  (-main *command-line-args*))
