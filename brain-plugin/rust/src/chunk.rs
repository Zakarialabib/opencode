use tree_sitter::{Node, Parser};

#[derive(Clone)]
pub struct Chunk {
    pub path: String,
    pub text: String,
    pub start_line: usize,
}

pub fn chunk_file(path: &str, content: &str) -> Vec<Chunk> {
    let ext = std::path::Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("");

    let mut parser = Parser::new();
    match ext {
        "rs" => parser.set_language(&tree_sitter_rust::LANGUAGE.into()),
        "ts" | "tsx" => parser.set_language(&tree_sitter_typescript::LANGUAGE_TYPESCRIPT.into()),
        "py" => parser.set_language(&tree_sitter_python::LANGUAGE.into()),
        "php" => parser.set_language(&tree_sitter_php::LANGUAGE_PHP.into()),
        _ => return line_based_chunk(path, content),
    }.ok();

    let tree = parser.parse(content, None).unwrap();
    let root = tree.root_node();
    let mut chunks = vec![];
    extract_nodes(path, content, root, &mut chunks);
    chunks
}

fn extract_nodes(path: &str, content: &str, node: Node, chunks: &mut Vec<Chunk>) {
    match node.kind() {
        "function_item" | "function_declaration" | "method_definition" |
        "class_declaration" | "struct_item" | "impl_item" => {
            chunks.push(Chunk {
                path: path.to_string(),
                text: content[node.start_byte()..node.end_byte()].to_string(),
                start_line: node.start_position().row + 1,
            });
        }
        _ => {
            for i in 0..node.child_count() {
                extract_nodes(path, content, node.child(i).unwrap(), chunks);
            }
        }
    }
}

fn line_based_chunk(path: &str, content: &str) -> Vec<Chunk> {
    let lines: Vec<&str> = content.lines().collect();
    let mut chunks = vec![];
    for (i, chunk_lines) in lines.chunks(30).enumerate() {
        let start_line = i * 30 + 1;
        let text = chunk_lines.join("\n");
        chunks.push(Chunk {
            path: path.to_string(),
            text,
            start_line,
        });
    }
    chunks
}