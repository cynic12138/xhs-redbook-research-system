export interface DatabaseMigration {
  version: number;
  name: string;
  sql: string;
}

export const databaseMigrations: readonly DatabaseMigration[] = [
  {
    version: 1,
    name: "initial-domain-schema",
    sql: `
      CREATE TABLE app_state (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL CHECK (json_valid(value_json)),
        updated_at TEXT NOT NULL
      );

      CREATE TABLE legacy_imports (
        id TEXT PRIMARY KEY,
        source_fingerprint TEXT NOT NULL UNIQUE,
        source_label TEXT NOT NULL,
        imported_at TEXT NOT NULL,
        counts_json TEXT NOT NULL CHECK (json_valid(counts_json)),
        schema_version INTEGER NOT NULL
      );

      CREATE TABLE search_jobs (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        position INTEGER NOT NULL,
        data_json TEXT NOT NULL CHECK (json_valid(data_json))
      );

      CREATE TABLE notes (
        id TEXT PRIMARY KEY,
        author_id TEXT,
        type TEXT NOT NULL,
        published_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        position INTEGER NOT NULL,
        data_json TEXT NOT NULL CHECK (json_valid(data_json))
      );

      CREATE TABLE note_jobs (
        note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
        job_id TEXT NOT NULL REFERENCES search_jobs(id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        PRIMARY KEY (note_id, job_id)
      );

      CREATE TABLE queue_items (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL REFERENCES search_jobs(id) ON DELETE CASCADE,
        note_id TEXT,
        kind TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        position INTEGER NOT NULL,
        data_json TEXT NOT NULL CHECK (json_valid(data_json))
      );

      CREATE TABLE comments (
        id TEXT PRIMARY KEY,
        note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
        author_id TEXT,
        created_at TEXT NOT NULL,
        position INTEGER NOT NULL,
        data_json TEXT NOT NULL CHECK (json_valid(data_json))
      );

      CREATE TABLE authors (
        id TEXT PRIMARY KEY,
        updated_at TEXT NOT NULL,
        position INTEGER NOT NULL,
        data_json TEXT NOT NULL CHECK (json_valid(data_json))
      );

      CREATE TABLE author_posts (
        id TEXT PRIMARY KEY,
        author_id TEXT NOT NULL,
        position INTEGER NOT NULL,
        data_json TEXT NOT NULL CHECK (json_valid(data_json))
      );

      CREATE TABLE analysis_reports (
        job_id TEXT PRIMARY KEY,
        generated_at TEXT NOT NULL,
        position INTEGER NOT NULL,
        data_json TEXT NOT NULL CHECK (json_valid(data_json))
      );

      CREATE TABLE ai_models (
        id TEXT PRIMARY KEY,
        is_default INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        position INTEGER NOT NULL,
        data_json TEXT NOT NULL CHECK (json_valid(data_json))
      );

      CREATE TABLE ai_reports (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        position INTEGER NOT NULL,
        data_json TEXT NOT NULL CHECK (json_valid(data_json))
      );

      CREATE TABLE ai_artifacts (
        id TEXT PRIMARY KEY,
        workflow_key TEXT NOT NULL,
        job_id TEXT,
        note_id TEXT,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        position INTEGER NOT NULL,
        data_json TEXT NOT NULL CHECK (json_valid(data_json))
      );

      CREATE TABLE ai_prompt_configs (
        key TEXT PRIMARY KEY,
        updated_at TEXT NOT NULL,
        position INTEGER NOT NULL,
        data_json TEXT NOT NULL CHECK (json_valid(data_json))
      );

      CREATE TABLE ai_custom_prompts (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        position INTEGER NOT NULL,
        data_json TEXT NOT NULL CHECK (json_valid(data_json))
      );

      CREATE TABLE ai_custom_prompt_revisions (
        id TEXT PRIMARY KEY,
        prompt_id TEXT NOT NULL REFERENCES ai_custom_prompts(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        position INTEGER NOT NULL,
        data_json TEXT NOT NULL CHECK (json_valid(data_json))
      );

      CREATE TABLE ai_orchestrations (
        id TEXT PRIMARY KEY,
        job_id TEXT,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        position INTEGER NOT NULL,
        data_json TEXT NOT NULL CHECK (json_valid(data_json))
      );

      CREATE TABLE ai_goal_runs (
        id TEXT PRIMARY KEY,
        job_id TEXT,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        position INTEGER NOT NULL,
        data_json TEXT NOT NULL CHECK (json_valid(data_json))
      );

      CREATE TABLE ai_messages (
        id TEXT PRIMARY KEY,
        role TEXT NOT NULL,
        created_at TEXT NOT NULL,
        position INTEGER NOT NULL,
        data_json TEXT NOT NULL CHECK (json_valid(data_json))
      );

      CREATE TABLE reply_plans (
        id TEXT PRIMARY KEY,
        note_id TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        position INTEGER NOT NULL,
        data_json TEXT NOT NULL CHECK (json_valid(data_json))
      );

      CREATE TABLE reply_actions (
        id TEXT PRIMARY KEY,
        plan_id TEXT NOT NULL REFERENCES reply_plans(id) ON DELETE CASCADE,
        note_id TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        position INTEGER NOT NULL,
        data_json TEXT NOT NULL CHECK (json_valid(data_json))
      );

      CREATE TABLE health_reports (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        generated_at TEXT NOT NULL,
        position INTEGER NOT NULL,
        data_json TEXT NOT NULL CHECK (json_valid(data_json))
      );

      CREATE TABLE boards (
        id TEXT PRIMARY KEY,
        updated_at TEXT NOT NULL,
        position INTEGER NOT NULL,
        data_json TEXT NOT NULL CHECK (json_valid(data_json))
      );

      CREATE TABLE favorite_notes (
        id TEXT PRIMARY KEY,
        updated_at TEXT NOT NULL,
        position INTEGER NOT NULL,
        data_json TEXT NOT NULL CHECK (json_valid(data_json))
      );

      CREATE TABLE content_playbooks (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        position INTEGER NOT NULL,
        data_json TEXT NOT NULL CHECK (json_valid(data_json))
      );

      CREATE TABLE content_playbook_revisions (
        id TEXT PRIMARY KEY,
        playbook_id TEXT NOT NULL REFERENCES content_playbooks(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        position INTEGER NOT NULL,
        data_json TEXT NOT NULL CHECK (json_valid(data_json))
      );

      CREATE TABLE content_projects (
        id TEXT PRIMARY KEY,
        playbook_id TEXT,
        job_id TEXT,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        position INTEGER NOT NULL,
        data_json TEXT NOT NULL CHECK (json_valid(data_json))
      );

      CREATE TABLE content_project_materials (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES content_projects(id) ON DELETE CASCADE,
        source TEXT NOT NULL,
        source_id TEXT,
        category TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        position INTEGER NOT NULL,
        data_json TEXT NOT NULL CHECK (json_valid(data_json))
      );

      CREATE TABLE content_drafts (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        playbook_id TEXT,
        job_id TEXT,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        position INTEGER NOT NULL,
        data_json TEXT NOT NULL CHECK (json_valid(data_json))
      );

      CREATE TABLE content_reviews (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        playbook_id TEXT,
        job_id TEXT,
        note_id TEXT,
        draft_id TEXT,
        status TEXT NOT NULL,
        risk TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        position INTEGER NOT NULL,
        data_json TEXT NOT NULL CHECK (json_valid(data_json))
      );

      CREATE INDEX idx_queue_items_job_status ON queue_items(job_id, status, position);
      CREATE INDEX idx_note_jobs_job_position ON note_jobs(job_id, position);
      CREATE INDEX idx_comments_note_position ON comments(note_id, position);
      CREATE INDEX idx_author_posts_author_position ON author_posts(author_id, position);
      CREATE INDEX idx_ai_reports_job_created ON ai_reports(job_id, created_at DESC);
      CREATE INDEX idx_ai_artifacts_job_created ON ai_artifacts(job_id, created_at DESC);
      CREATE INDEX idx_ai_artifacts_workflow_created ON ai_artifacts(workflow_key, created_at DESC);
      CREATE INDEX idx_ai_custom_prompt_revisions_prompt_created ON ai_custom_prompt_revisions(prompt_id, created_at DESC);
      CREATE INDEX idx_reply_actions_plan_status ON reply_actions(plan_id, status, position);
      CREATE INDEX idx_content_projects_status_updated ON content_projects(status, updated_at DESC);
      CREATE INDEX idx_content_materials_project_position ON content_project_materials(project_id, position);
      CREATE INDEX idx_content_drafts_project_created ON content_drafts(project_id, created_at DESC);
      CREATE INDEX idx_content_reviews_project_created ON content_reviews(project_id, created_at DESC);
    `
  }
];
