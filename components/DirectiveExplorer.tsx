"use client";

import Link from "next/link";
import { useMemo, useRef, useSyncExternalStore } from "react";
import type { Organization, Theme } from "@/lib/data";
import {
  EMPTY_DIRECTIVE_FILTERS,
  parseDirectiveFilters,
  serializeDirectiveFilters,
} from "@/lib/directive-filters.mjs";
import { formatDate } from "@/lib/format";

const FILTER_CHANGE_EVENT = "directive-filters-change";

function subscribeToFilterUrl(onStoreChange: () => void) {
  window.addEventListener("popstate", onStoreChange);
  window.addEventListener(FILTER_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("popstate", onStoreChange);
    window.removeEventListener(FILTER_CHANGE_EVENT, onStoreChange);
  };
}

function getFilterUrlSnapshot() {
  return window.location.search;
}

function getServerFilterUrlSnapshot() {
  return "";
}

type ExplorerOrganization = Pick<Organization, "id" | "name" | "shortName">;

export interface ExplorerDirective {
  id: string;
  label: string;
  title: string;
  excerpt: string;
  leadOrgIds: string[];
  leadOrganizations: ExplorerOrganization[];
  collaboratorOrganizations: ExplorerOrganization[];
  mentionedOrganizations: ExplorerOrganization[];
  timing: Array<{
    sourceText: string;
    derivedDate: string;
    appliesTo: string;
  }>;
  analysis: {
    summary: string;
    themeIds: string[];
  };
  themes: Theme[];
}

interface Props {
  directives: ExplorerDirective[];
  themes: Theme[];
  leadOrganizations: Organization[];
}

export function DirectiveExplorer({
  directives,
  themes,
  leadOrganizations,
}: Props) {
  const searchRef = useRef<HTMLInputElement>(null);
  const urlSearch = useSyncExternalStore(
    subscribeToFilterUrl,
    getFilterUrlSnapshot,
    getServerFilterUrlSnapshot,
  );
  const validFilterValues = useMemo(
    () => ({
      themeIds: themes.map((item) => item.id),
      leadIds: leadOrganizations.map((item) => item.id),
    }),
    [leadOrganizations, themes],
  );
  const filters = useMemo(
    () =>
      parseDirectiveFilters(
        new URLSearchParams(urlSearch),
        validFilterValues,
      ),
    [urlSearch, validFilterValues],
  );
  const { query, theme, lead, timing } = filters;

  function updateFilters(nextFilters: typeof filters) {
    const currentUrl = new URL(window.location.href);
    const search = serializeDirectiveFilters(
      nextFilters,
      currentUrl.searchParams,
    );
    const nextUrl = `${currentUrl.pathname}${search ? `?${search}` : ""}${currentUrl.hash}`;
    const currentRelativeUrl = `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`;

    if (nextUrl !== currentRelativeUrl) {
      window.history.replaceState(window.history.state, "", nextUrl);
      window.dispatchEvent(new Event(FILTER_CHANGE_EVENT));
    }
  }

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return directives.filter((directive) => {
      const searchable = [
        directive.label,
        directive.title,
        directive.excerpt,
        directive.analysis.summary,
        ...[
          ...directive.leadOrganizations,
          ...directive.collaboratorOrganizations,
          ...directive.mentionedOrganizations,
        ].flatMap((organization) => [organization.name, organization.shortName]),
        ...directive.themes.map((item) => item.name),
      ]
        .join(" ")
        .toLocaleLowerCase();

      return (
        (!normalizedQuery || searchable.includes(normalizedQuery)) &&
        (!theme || directive.analysis.themeIds.includes(theme)) &&
        (!lead || directive.leadOrgIds.includes(lead)) &&
        (!timing ||
          (timing === "explicit" ? directive.timing.length > 0 : directive.timing.length === 0))
      );
    });
  }, [directives, lead, query, theme, timing]);

  const hasFilters = Boolean(query || theme || lead || timing);

  function reset() {
    updateFilters(EMPTY_DIRECTIVE_FILTERS);
    requestAnimationFrame(() => searchRef.current?.focus());
  }

  return (
    <div className="explorer">
      <div className="filters" role="search" aria-labelledby="filter-title">
        <div className="filters__heading">
          <div>
            <p className="utility-label">Explore the signed structure</p>
            <h3 id="filter-title">Find a directive</h3>
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
            onChange={(event) =>
              updateFilters({ ...filters, query: event.target.value })
            }
            placeholder="Try ‘funding’, ‘Caltrans’, or ‘3(b)’"
          />
        </label>

        <label>
          <span>Theme</span>
          <select
            value={theme}
            onChange={(event) =>
              updateFilters({ ...filters, theme: event.target.value })
            }
          >
            <option value="">All themes</option>
            {themes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Explicit lead</span>
          <select
            value={lead}
            onChange={(event) =>
              updateFilters({ ...filters, lead: event.target.value })
            }
          >
            <option value="">All named leads</option>
            {leadOrganizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.shortName}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Timing in the order</span>
          <select
            value={timing}
            onChange={(event) =>
              updateFilters({ ...filters, timing: event.target.value })
            }
          >
            <option value="">All timing</option>
            <option value="explicit">Explicit timing</option>
            <option value="none">No explicit deadline stated</option>
          </select>
        </label>
      </div>

      <div className="results">
        <div className="results__heading">
          <h3>Directive units</h3>
          <p aria-live="polite" aria-atomic="true">
            Showing {filtered.length} of {directives.length}
          </p>
        </div>

        {filtered.length > 0 ? (
          <ol className="directive-list">
            {filtered.map((directive) => (
              <li key={directive.id}>
                <article className="directive-card">
                  <div className="directive-card__rail">
                    <span><span className="visually-hidden">Directive </span>{directive.label}</span>
                  </div>
                  <div className="directive-card__body">
                    <p className="utility-label">Editorial record title</p>
                    <h4>{directive.title}</h4>
                    <div className="directive-card__source">
                      <p className="utility-label">Source record</p>
                      <p className="directive-card__excerpt">“{directive.excerpt}”</p>
                      <p>
                        <strong>Explicit lead:</strong>{" "}
                        {directive.leadOrganizations.map((item) => item.shortName).join(", ")}
                      </p>
                      {directive.timing.length > 0 ? (
                        <ul className="card-timing-list" aria-label="Timing in the signed order">
                          {directive.timing.map((item) => (
                            <li key={`${item.sourceText}-${item.appliesTo}`}>
                              <strong>Calculated planning date: {formatDate(item.derivedDate)}</strong>
                              <span>{item.sourceText} · applies to {item.appliesTo}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="timing-chip timing-chip--none">No explicit completion deadline in the signed order</p>
                      )}
                    </div>
                    <div className="directive-card__analysis">
                      <p className="utility-label">Independent analysis</p>
                      <p>{directive.analysis.summary}</p>
                      <ul className="tag-list" aria-label="Analytical themes">
                        {directive.themes.map((item) => (
                          <li key={item.id}>{item.name}</li>
                        ))}
                      </ul>
                    </div>
                    <Link
                      className="inspect-link"
                      href={`/directives/${directive.id}`}
                      aria-label={`Inspect source, evidence, and analysis for directive ${directive.label}: ${directive.title}`}
                    >
                      Inspect source, evidence, and analysis <span aria-hidden="true">→</span>
                    </Link>
                  </div>
                </article>
              </li>
            ))}
          </ol>
        ) : (
          <div className="empty-state">
            <h4>No directives match these filters.</h4>
            <p>Clear one filter or reset the explorer to return to document order.</p>
            <button type="button" className="button button--secondary" onClick={reset}>
              Reset filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
