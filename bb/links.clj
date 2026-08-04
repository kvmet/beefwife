#!/usr/bin/env bb

;; Relative-link checker for Markdown. Every inline link [text](target) whose
;; target is a relative path (not a URL, not a bare #anchor) must resolve to an
;; existing file or directory, relative to the linking file. A #anchor suffix is
;; stripped before resolving; anchor existence itself is not validated.
;;
;; Usable two ways, mirroring `length`:
;;   - standalone:  bb bb/links.clj <file-or-dir>...
;;   - as a library: (require '[links]) and call `check-file` / `check-paths`.

(ns links
  (:require [babashka.fs :as fs]
            [clojure.string :as str]))

;; Inline links [text](target) and [text](target "title"). Captures the target,
;; stopping at whitespace or the closing paren so a trailing title is excluded.
(def ^:private link-re #"\[[^\]]*\]\(([^)\s]+)(?:\s+\"[^\"]*\")?\)")

(defn- external? [target]
  (or (re-find #"^[a-z][a-z0-9+.-]*:" target)   ; scheme: (http:, https:, mailto:, ...)
      (str/starts-with? target "#")))           ; same-page anchor

(defn- strip-anchor [target]
  (str/replace target #"#.*$" ""))

(defn check-file
  "Check relative Markdown links in one file. Non-.md files come back :skip.
  Returns {:status :ok|:fail|:skip :path s :hits [{:line n :target s :resolved s}]}."
  [path]
  (if-not (= "md" (fs/extension path))
    {:status :skip :path (str path)}
    (try
      (let [dir  (or (fs/parent path) ".")
            hits (->> (fs/read-all-lines path)
                      (map-indexed
                       (fn [i line]
                         (keep (fn [[_ target]]
                                 (let [rel (strip-anchor target)]
                                   (when (and (not (external? target)) (seq rel))
                                     (let [resolved (fs/normalize (fs/path dir rel))]
                                       (when-not (fs/exists? resolved)
                                         {:line (inc i) :target target :resolved (str resolved)})))))
                               (re-seq link-re line))))
                      (apply concat)
                      vec)]
        {:status (if (seq hits) :fail :ok) :path (str path) :hits hits})
      (catch Exception _
        {:status :skip :path (str path)}))))

(defn check-paths
  "Check many paths (files only); non-.md paths are skipped."
  [paths]
  (map check-file paths))

(defn report
  "Print one line per broken link. :ok and :skip are silent."
  [{:keys [status path hits]}]
  (when (= :fail status)
    (doseq [{:keys [line target]} hits]
      (println (str "LINK:  " path ":" line ": unresolved relative link: " target)))))

(defn- expand [arg]
  (if (fs/directory? arg)
    (filter fs/regular-file? (fs/glob arg "**"))
    [(fs/path arg)]))

(defn -main [args]
  (when (empty? args)
    (println "Usage: bb bb/links.clj <file-or-dir>...")
    (System/exit 1))
  (let [results (check-paths (mapcat expand args))
        fails   (filter #(= :fail (:status %)) results)]
    (run! report results)
    (when (seq fails)
      (System/exit 1))))

(when (= *file* (System/getProperty "babashka.file"))
  (-main *command-line-args*))
