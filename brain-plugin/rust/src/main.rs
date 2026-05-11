use axum::{
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::time::Instant;
use crate::lmstudio::LMStudioClient;

#[derive(Deserialize)]
struct IndexRequest {
    project_root: String,
    extensions: Option<Vec<String>>,
    force: Option<bool>,
}

#[derive(Serialize)]
struct IndexResponse {
    files_indexed: usize,
    chunks: usize,
    duration_ms: u64,
}

#[derive(Deserialize)]
struct SearchRequest {
    query: String,
    top_k: Option<usize>,
    project_id: Option<String>,
}

#[derive(Serialize)]
struct SearchResult {
    path: String,
    start_line: usize,
    text: String,
    score: f32,
}

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/health", get(health))
        .route("/index", post(index_project))
        .route("/search", post(search))
        .route("/embed", post(embed_batch));

    let addr: SocketAddr = "127.0.0.1:7878".parse().unwrap();
    println!("brain-embed listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn health() -> Json<serde_json::Value> {
    Json(serde_json::json!({ "status": "ok" }))
}

async fn index_project(Json(_req): Json<IndexRequest>) -> Json<IndexResponse> {
    // TODO: implement indexing
    Json(IndexResponse {
        files_indexed: 0,
        chunks: 0,
        duration_ms: 0,
    })
}

async fn search(Json(_req): Json<SearchRequest>) -> Json<Vec<SearchResult>> {
    // TODO: implement search
    // Mock results for testing
    Json(vec![
        SearchResult {
            path: "src/main.rs".to_string(),
            start_line: 1,
            text: "fn main() {\n    println!(\"Hello, world!\");\n}".to_string(),
            score: 0.9,
        },
        SearchResult {
            path: "src/lib.rs".to_string(),
            start_line: 10,
            text: "pub fn add(a: i32, b: i32) -> i32 {\n    a + b\n}".to_string(),
            score: 0.8,
        },
    ])
}

async fn embed_batch(Json(texts): Json<Vec<String>>) -> Json<Vec<Vec<f32>>> {
    let client = LMStudioClient::new("http://192.168.1.12:1234"); // TODO: make configurable
    match client.embed(&texts, "text-embedding-nomic-embed-text-v1.5").await {
        Ok(embeddings) => Json(embeddings),
        Err(e) => {
            eprintln!("Embed error: {:?}", e);
            Json(vec![])
        }
    }
}