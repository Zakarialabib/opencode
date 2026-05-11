use lancedb::{connect, Table, TableRef};
use arrow_array::{Float32Array, StringArray, RecordBatch, UInt64Array, ListArray, types::UInt64Type};
use arrow_schema::{DataType, Field, Schema};
use std::sync::Arc;

#[derive(Clone)]
pub struct Record {
    pub path: String,
    pub text: String,
    pub start_line: usize,
    pub vector: Vec<f32>,
}

#[derive(Clone)]
pub struct SearchResult {
    pub path: String,
    pub start_line: usize,
    pub text: String,
    pub score: f32,
}

pub struct VectorStore {
    table: TableRef,
}

impl VectorStore {
    pub async fn open(db_path: &str) -> anyhow::Result<Self> {
        let db = connect(db_path).execute().await?;
        let table = if db.table_names().await?.contains(&"codebase".to_string()) {
            db.open_table("codebase").execute().await?
        } else {
            let schema = Arc::new(Schema::new(vec![
                Field::new("path", DataType::Utf8, false),
                Field::new("text", DataType::Utf8, false),
                Field::new("start_line", DataType::UInt64, false),
                Field::new("vector", DataType::new_list(DataType::Float32, false), false),
            ]));
            db.create_empty_table("codebase", schema).execute().await?
        };
        Ok(Self { table })
    }

    pub async fn insert(&self, records: Vec<Record>) -> anyhow::Result<()> {
        let paths: Vec<String> = records.iter().map(|r| r.path.clone()).collect();
        let texts: Vec<String> = records.iter().map(|r| r.text.clone()).collect();
        let start_lines: Vec<u64> = records.iter().map(|r| r.start_line as u64).collect();
        let vectors: Vec<Vec<f32>> = records.iter().map(|r| r.vector.clone()).collect();

        let path_array = StringArray::from(paths);
        let text_array = StringArray::from(texts);
        let start_line_array = UInt64Array::from(start_lines);
        let vector_array = ListArray::from_iter_primitive::<Float32Array, _, _>(
            vectors.into_iter().map(|v| Some(Float32Array::from(v))),
        );

        let batch = RecordBatch::try_new(
            self.table.schema().await?,
            vec![
                Arc::new(path_array),
                Arc::new(text_array),
                Arc::new(start_line_array),
                Arc::new(vector_array),
            ],
        )?;

        self.table.add(vec![batch]).execute().await?;
        Ok(())
    }

    pub async fn search(&self, query_vec: &[f32], top_k: usize) -> anyhow::Result<Vec<SearchResult>> {
        let results = self.table
            .search(query_vec)
            .limit(top_k)
            .execute()
            .await?
            .collect::<Vec<_>>()
            .await;

        let mut search_results = vec![];
        for result in results {
            let path = result.column(0).as_string::<i32>().unwrap().value(0).to_string();
            let text = result.column(1).as_string::<i32>().unwrap().value(0).to_string();
            let start_line = result.column(2).as_primitive::<UInt64Type>().unwrap().value(0) as usize;
            let score = result.score.unwrap_or(0.0);
            search_results.push(SearchResult {
                path,
                text,
                start_line,
                score,
            });
        }
        Ok(search_results)
    }

    pub async fn create_index(&self) -> anyhow::Result<()> {
        self.table.create_index(&["vector"]).ivf_pq().execute().await?;
        Ok(())
    }
}