use reqwest::Client;
use serde_json::json;

pub struct LMStudioClient {
    client: Client,
    base_url: String,
}

impl LMStudioClient {
    pub fn new(base_url: impl Into<String>) -> Self {
        Self {
            client: Client::new(),
            base_url: base_url.into(),
        }
    }

    pub async fn embed(&self, texts: &[String], model: &str) -> anyhow::Result<Vec<Vec<f32>>> {
        let res = self.client
            .post(format!("{}/v1/embeddings", self.base_url))
            .json(&json!({
                "model": model,
                "input": texts
            }))
            .send()
            .await?
            .json::<serde_json::Value>()
            .await?;

        let data = res["data"].as_array().ok_or(anyhow::anyhow!("invalid response"))?;
        let embeddings: Vec<Vec<f32>> = data.iter()
            .map(|d| d["embedding"].as_array().unwrap().iter()
                .map(|v| v.as_f64().unwrap() as f32)
                .collect())
            .collect();
        Ok(embeddings)
    }

    pub async fn load_model(&self, model: &str) -> anyhow::Result<String> {
        let res = self.client
            .post(format!("{}/api/v1/models/load", self.base_url))
            .json(&json!({
                "model": model,
                "context_length": 8192,
                "flash_attention": true
            }))
            .send()
            .await?
            .json::<serde_json::Value>()
            .await?;
        Ok(res["instance_id"].as_str().unwrap().to_string())
    }

    pub async fn unload_model(&self, instance_id: &str) -> anyhow::Result<()> {
        self.client
            .post(format!("{}/api/v1/models/unload", self.base_url))
            .json(&json!({ "instance_id": instance_id }))
            .send()
            .await?;
        Ok(())
    }
}