"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import {
  filterDependencyRoutes,
  filterNamedBodies,
} from "@/lib/relationship-filters";
import type {
  DependencyRoute,
  NamedBodyRecord,
  SourceRole,
} from "@/lib/relationships";

interface ExplorerTheme {
  id: string;
  name: string;
}

const roleLabels: Record<SourceRole, string> = {
  lead: "Explicit lead",
  collaborator: "Explicit collaborator",
  mentioned: "Other named party",
};

const roleOrder: SourceRole[] = ["lead", "collaborator", "mentioned"];

export function OrganizationExplorer({ records }: { records: NamedBodyRecord[] }) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("");
  const [role, setRole] = useState<"" | SourceRole>("");
  const searchRef = useRef<HTMLInputElement>(null);

  const kinds = useMemo(
    () =>
      [...new Map(records.map((record) => [record.kind, record.kindLabel])).entries()].map(
        ([id, label]) => ({ id, label }),
      ),
    [records],
  );

  const filtered = useMemo(() => {
    return filterNamedBodies(records, { query, kind, role });
  }, [kind, query, records, role]);

  const hasFilters = Boolean(query || kind || role);

  function reset() {
    setQuery("");
    setKind("");
    setRole("");
    requestAnimationFrame(() => searchRef.current?.focus());
  }

  return (
    <div className="relationship-explorer explorer">
      <form
        className="filters"
        role="search"
        aria-labelledby="organization-filter-title"
        onSubmit={(event) => event.preventDefault()}
      >
        <div className="filters__heading">
          <div>
            <p className="utility-label">Filter source relationships</p>
            <h3 id="organization-filter-title">Find a body or group</h3>
          </div>
          {hasFilters ? (
            <button type="button" className="text-button" onClick={reset}>
              Reset all
            </button>
          ) : null}
        </div>

        <label>
          <span>Search</span>
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Try ‘federal’, ‘CTC’, or ‘3(j)’"
          />
        </label>

        <label>
          <span>Body or group type</span>
          <select value={kind} onChange={(event) => setKind(event.target.value)}>
            <option value="">All types</option>
            {kinds.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Relationship in source</span>
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as "" | SourceRole)}
          >
            <option value="">All source roles</option>
            {roleOrder.map((item) => (
              <option key={item} value={item}>
                {roleLabels[item]}
              </option>
            ))}
          </select>
        </label>
      </form>

      <div className="relationship-results">
        <div className="results__heading">
          <h3>Named bodies and groups</h3>
          <p aria-live="polite" aria-atomic="true">
            Showing {filtered.length} of {records.length}
          </p>
        </div>

        {filtered.length > 0 ? (
          <ol className="organization-list">
            {filtered.map((record) => (
              <li
                key={record.id}
                className={record.id === "caltrans" ? "organization-list__featured" : undefined}
              >
                <article
                  className="organization-card"
                  aria-labelledby={`organization-${record.id}-title`}
                >
                  <div className="organization-card__signal" aria-hidden="true">
                    <span />
                  </div>
                  <div className="organization-card__body">
                    <p className="utility-label">{record.kindLabel}</p>
                    <h4 id={`organization-${record.id}-title`}>{record.shortName}</h4>
                    {record.name !== record.shortName ? (
                      <p className="organization-card__name">{record.name}</p>
                    ) : null}

                    <dl className="role-counts" aria-label="Explicit source relationship counts">
                      {roleOrder.map((sourceRole) => {
                        const count = record.occurrences.filter(
                          (occurrence) => occurrence.role === sourceRole,
                        ).length;
                        return (
                          <div key={sourceRole}>
                            <dt>{roleLabels[sourceRole]}</dt>
                            <dd>{count}</dd>
                          </div>
                        );
                      })}
                    </dl>

                    <div className="organization-card__roles">
                      {roleOrder.map((sourceRole) => {
                        const occurrences = record.occurrences.filter(
                          (occurrence) => occurrence.role === sourceRole,
                        );
                        if (occurrences.length === 0) return null;
                        const headingId = `${record.id}-${sourceRole}-title`;
                        return (
                          <section key={sourceRole} aria-labelledby={headingId}>
                            <h5 id={headingId}>{roleLabels[sourceRole]}</h5>
                            <ul>
                              {occurrences.map((occurrence) => (
                                <li key={`${sourceRole}-${occurrence.id}`}>
                                  <Link href={`/directives/${occurrence.id}`}>
                                    <span>{occurrence.label}</span>
                                    {occurrence.title}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          </section>
                        );
                      })}
                    </div>
                  </div>
                </article>
              </li>
            ))}
          </ol>
        ) : (
          <div className="empty-state">
            <h4>No named bodies or groups match.</h4>
            <p>Clear one filter or reset this source-relationship view.</p>
            <button type="button" className="button button--secondary" onClick={reset}>
              Reset filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

interface DependencyExplorerProps {
  routes: DependencyRoute[];
  themes: ExplorerTheme[];
  totalReferences: number;
}

export function DependencyExplorer({
  routes,
  themes,
  totalReferences,
}: DependencyExplorerProps) {
  const [query, setQuery] = useState("");
  const [theme, setTheme] = useState("");
  const [confidence, setConfidence] = useState("");
  const [connection, setConnection] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    return filterDependencyRoutes(routes, { query, theme, confidence, connection });
  }, [confidence, connection, query, routes, theme]);

  const visibleReferences = filtered.reduce(
    (sum, route) => sum + route.relatedDirectives.length,
    0,
  );
  const hasFilters = Boolean(query || theme || confidence || connection);

  function reset() {
    setQuery("");
    setTheme("");
    setConfidence("");
    setConnection("");
    requestAnimationFrame(() => searchRef.current?.focus());
  }

  return (
    <div className="relationship-explorer explorer">
      <form
        className="filters filters--analysis"
        role="search"
        aria-labelledby="dependency-filter-title"
        onSubmit={(event) => event.preventDefault()}
      >
        <div className="filters__heading">
          <div>
            <p className="utility-label">Filter independent analysis</p>
            <h3 id="dependency-filter-title">Find a relationship</h3>
          </div>
          {hasFilters ? (
            <button type="button" className="text-button" onClick={reset}>
              Reset all
            </button>
          ) : null}
        </div>

        <label>
          <span>Search</span>
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Try ‘data’, ‘permitting’, or ‘6’"
          />
        </label>

        <label>
          <span>Analytical theme</span>
          <select value={theme} onChange={(event) => setTheme(event.target.value)}>
            <option value="">All themes</option>
            {themes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Analyst confidence</span>
          <select
            value={confidence}
            onChange={(event) => setConfidence(event.target.value)}
          >
            <option value="">All confidence labels</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>

        <label>
          <span>Cross-reference</span>
          <select
            value={connection}
            onChange={(event) => setConnection(event.target.value)}
          >
            <option value="">All dependency statements</option>
            <option value="linked">Names another directive</option>
            <option value="unlinked">No directive cross-reference</option>
          </select>
        </label>
      </form>

      <div className="relationship-results">
        <div className="results__heading">
          <h3>Inferred dependencies</h3>
          <p aria-live="polite" aria-atomic="true">
            Showing {filtered.length} of {routes.length} statements · {visibleReferences} of{" "}
            {totalReferences} cross-references
          </p>
        </div>

        {filtered.length > 0 ? (
          <ol className="dependency-list">
            {filtered.map((route) => (
              <li key={route.id}>
                <article
                  className="dependency-route"
                  aria-labelledby={`${route.id}-title`}
                >
                  <div className="dependency-route__origin">
                    <span>
                      <span className="visually-hidden">Directive </span>
                      {route.directive.label}
                    </span>
                  </div>
                  <div className="dependency-route__body">
                    <p className="utility-label">Independent analytical record</p>
                    <h4 id={`${route.id}-title`}>
                      <Link
                        className="dependency-route__record-link"
                        href={`/directives/${route.directive.id}`}
                      >
                        {route.directive.title}
                      </Link>
                    </h4>
                    <p className="dependency-route__text">{route.text}</p>
                    <p className="dependency-route__confidence">
                      Inference · {route.confidence} confidence
                    </p>
                    <ul className="tag-list" aria-label="Analytical themes">
                      {route.themes.map((item) => (
                        <li key={item.id}>{item.name}</li>
                      ))}
                    </ul>

                    {route.relatedDirectives.length > 0 ? (
                      <div className="dependency-route__connections">
                        <h5>This inferred dependency cross-references</h5>
                        <ul>
                          {route.relatedDirectives.map((related) => (
                            <li key={related.id}>
                              <Link href={`/directives/${related.id}`}>
                                <span>{related.label}</span>
                                {related.title}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <p className="dependency-route__empty">
                        No cross-directive link is recorded for this dependency in the current
                        analytical layer.
                      </p>
                    )}
                  </div>
                </article>
              </li>
            ))}
          </ol>
        ) : (
          <div className="empty-state">
            <h4>No inferred dependencies match.</h4>
            <p>Clear one filter or reset this analytical-relationship view.</p>
            <button type="button" className="button button--secondary" onClick={reset}>
              Reset filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
