//! Forgetting messages when a product's retention period ends: finished
//! ones are deleted; a message that could still go out never is.

#![allow(clippy::unwrap_used, reason = "test code: a failed unwrap is a failed test")]

mod common;

use std::sync::Arc;

use common::{RecordingMailer, clock, sample_email};
use nudgewright::ids::TenantId;
use nudgewright::outbox::{NoExtraChecks, Outbox, OutboxError, Sender};
use sqlx::PgPool;

#[sqlx::test]
async fn finished_messages_are_forgotten_and_waiting_ones_kept(pool: PgPool) {
    let clock = clock();
    let outbox = Outbox::new(pool.clone(), clock.clone());
    let tenant = TenantId::new();
    let sent = outbox.create_draft(tenant, &sample_email()).await.unwrap();
    let seen = outbox.get(tenant, sent).await.unwrap().content_hash();
    outbox
        .approve(tenant, sent, "ana@santos.test", &seen, &NoExtraChecks)
        .await
        .unwrap();
    Sender::new(
        pool.clone(),
        RecordingMailer::idempotent(),
        clock.clone(),
        Arc::new(NoExtraChecks),
    )
    .drain_once(10)
    .await
    .unwrap();
    let cancelled = outbox.create_draft(tenant, &sample_email()).await.unwrap();
    outbox.cancel(tenant, cancelled, "ana@santos.test").await.unwrap();
    let waiting = outbox.create_draft(tenant, &sample_email()).await.unwrap();

    let forgotten = outbox.forget(tenant, &[sent, cancelled, waiting]).await.unwrap();

    assert_eq!(forgotten, 2);
    assert!(matches!(outbox.get(tenant, sent).await, Err(OutboxError::NotFound)));
    assert!(matches!(
        outbox.get(tenant, cancelled).await,
        Err(OutboxError::NotFound)
    ));
    assert!(outbox.get(tenant, waiting).await.is_ok());
}

#[sqlx::test]
async fn another_tenants_messages_are_never_forgotten(pool: PgPool) {
    let clock = clock();
    let outbox = Outbox::new(pool.clone(), clock.clone());
    let owner = TenantId::new();
    let id = outbox.create_draft(owner, &sample_email()).await.unwrap();
    outbox.cancel(owner, id, "ana@santos.test").await.unwrap();

    let forgotten = outbox.forget(TenantId::new(), &[id]).await.unwrap();

    assert_eq!(forgotten, 0);
    assert!(outbox.get(owner, id).await.is_ok());
}
