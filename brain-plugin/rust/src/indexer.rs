use std::sync::Arc;
use tokio::sync::Semaphore;

pub async fn embed_all_chunks(
    client: Arc<LMStudioClient>,
    chunks: Vec<Chunk>,
    model: &str,
    concurrency: usize,
) -> anyhow::Result<Vec<(Chunk, Vec<f32>)>> {
    let semaphore = Arc::new(Semaphore::new(concurrency));
    let mut handles = vec![];

    // Batch size 32 (double your current 16)
    for batch in chunks.chunks(32) {
        let texts: Vec<String> = batch.iter().map(|c| c.text.clone()).collect();
        let client = client.clone();
        let model = model.to_string();
        let permit = semaphore.clone().acquire_owned().await?;
        let batch_chunks = batch.to_vec();

        handles.push(tokio::spawn(async move {
            let _permit = permit; // hold until done
            let embeddings = client.embed(&texts, &model).await.unwrap();
            batch_chunks.into_iter().zip(embeddings.into_iter()).collect::<Vec<_>>()
        }));
    }

    let mut results = vec![];
    for h in handles {
        results.extend(h.await?);
    }
    Ok(results)
}