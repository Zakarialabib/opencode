use instant_distance::{HnswMap, MapItem};
use bincode::{serde::encode_to_vec, decode_from_slice};
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Clone)]
struct ChunkVec {
    path: String,
    text: String,
    start_line: usize,
    vector: Vec<f32>,
}

pub struct HnswStore {
    map: HnswMap<Vec<f32>, ChunkVec>,
}

impl HnswStore {
    pub fn load(path: &str) -> anyhow::Result<Self> {
        let bytes = std::fs::read(path)?;
        let (map, _): (HnswMap<Vec<f32>, ChunkVec>, _) = decode_from_slice(&bytes, bincode::config::standard())?;
        Ok(Self { map })
    }

    pub fn save(&self, path: &str) -> anyhow::Result<()> {
        let bytes = encode_to_vec(&self.map, bincode::config::standard())?;
        std::fs::write(path, bytes)?;
        Ok(())
    }

    pub fn search(&self, query: &[f32], top_k: usize) -> Vec<(ChunkVec, f32)> {
        self.map.search(query, top_k)
            .map(|(item, dist)| (item.value.clone(), 1.0 - dist as f32))
            .collect()
    }
}