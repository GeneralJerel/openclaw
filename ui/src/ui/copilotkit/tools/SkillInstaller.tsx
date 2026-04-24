/**
 * CopilotKit rendered tool: Skill Installer.
 *
 * Registers a useCopilotAction that renders browsable skill cards
 * from ClawHub marketplace with install buttons.
 */

import React, { useState } from "react";
import { useCopilotAction } from "@copilotkit/react-core";

type LocalSkill = {
  name: string;
  description: string;
  status: string;
  eligibility: string[];
};

type MarketplaceSkill = {
  slug: string;
  name: string;
  summary: string;
  version: string;
  author: string;
};

function StatusBadge({ status }: { status: string }) {
  const className =
    status === "ready"
      ? "ck-badge ck-badge--ok"
      : status === "needs-setup"
        ? "ck-badge ck-badge--warn"
        : "ck-badge ck-badge--muted";
  return <span className={className}>{status}</span>;
}

function LocalSkillCard({ skill }: { skill: LocalSkill }) {
  return (
    <div className="ck-skill-card">
      <div className="ck-skill-card__header">
        <span className="ck-skill-card__name">{skill.name}</span>
        <StatusBadge status={skill.status} />
      </div>
      {skill.description && (
        <p className="ck-skill-card__desc">{skill.description}</p>
      )}
      {skill.eligibility.length > 0 && (
        <ul className="ck-skill-card__eligibility">
          {skill.eligibility.map((reason, i) => (
            <li key={i}>{reason}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MarketplaceSkillCard({
  skill,
  onInstall,
}: {
  skill: MarketplaceSkill;
  onInstall: (slug: string) => void;
}) {
  const [installing, setInstalling] = useState(false);

  const handleInstall = () => {
    setInstalling(true);
    onInstall(skill.slug);
  };

  return (
    <div className="ck-skill-card ck-skill-card--marketplace">
      <div className="ck-skill-card__header">
        <span className="ck-skill-card__name">{skill.name}</span>
        {skill.version && (
          <span className="ck-badge ck-badge--muted">v{skill.version}</span>
        )}
      </div>
      {skill.summary && (
        <p className="ck-skill-card__desc">{skill.summary}</p>
      )}
      {skill.author && (
        <span className="ck-skill-card__author">by {skill.author}</span>
      )}
      <button
        className="ck-skill-card__install-btn"
        onClick={handleInstall}
        disabled={installing}
      >
        {installing ? "Installing..." : "Install"}
      </button>
    </div>
  );
}

function SkillsLoading() {
  return (
    <div className="ck-skills-list">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="ck-skill-card ck-skill-card--skeleton">
          <div className="ck-skeleton-line ck-skeleton-line--short" />
          <div className="ck-skeleton-line" />
        </div>
      ))}
    </div>
  );
}

export function SkillInstallerTool({
  onInstallSkill,
}: {
  onInstallSkill: (slug: string) => void;
}) {
  useCopilotAction({
    name: "skillsCatalog",
    description: "Browse available skills and search the ClawHub marketplace.",
    parameters: [
      {
        name: "query",
        type: "string",
        description: "Optional search query for ClawHub marketplace.",
        required: false,
      },
    ],
    render: ({ status, result }) => {
      if (status === "inProgress") {
        return <SkillsLoading />;
      }

      const data = typeof result === "string" ? JSON.parse(result) : result;
      const localSkills: LocalSkill[] = data?.localSkills ?? [];
      const marketplaceResults: MarketplaceSkill[] = data?.marketplaceResults ?? [];

      return (
        <div className="ck-skills-container">
          {marketplaceResults.length > 0 && (
            <div className="ck-skills-section">
              <h4 className="ck-section-title">Marketplace Results</h4>
              <div className="ck-skills-list">
                {marketplaceResults.map((skill) => (
                  <MarketplaceSkillCard
                    key={skill.slug}
                    skill={skill}
                    onInstall={onInstallSkill}
                  />
                ))}
              </div>
            </div>
          )}
          {localSkills.length > 0 && (
            <div className="ck-skills-section">
              <h4 className="ck-section-title">
                Installed Skills ({localSkills.length})
              </h4>
              <div className="ck-skills-list">
                {localSkills.map((skill) => (
                  <LocalSkillCard key={skill.name} skill={skill} />
                ))}
              </div>
            </div>
          )}
          {localSkills.length === 0 && marketplaceResults.length === 0 && (
            <div className="ck-empty-state">No skills found.</div>
          )}
        </div>
      );
    },
  });

  return null;
}
