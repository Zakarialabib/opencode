# 📚 GLM Skills Catalog

The `glm-skills` directory contains a rich library of specialized capabilities. Agents can leverage these to perform complex tasks outside of standard coding.

---

## 🌐 Browser & Web
| Skill | Purpose |
| :--- | :--- |
| **`agent-browser`** | Headless browser automation (Click, Type, Snapshot). |
| **`web-reader`** | Optimized for reading and summarizing long web articles. |
| **`seo-content-writer`** | Generates web content optimized for search engines. |
| **`web-shader-extractor`** | Specialized tool for extracting and analyzing WebGL shaders. |

## 💻 Development & Design
| Skill | Purpose |
| :--- | :--- |
| **`coding-agent`** | Advanced coding workflows (Plan -> Implement -> Verify). |
| **`fullstack-dev`** | Next.js 16, TypeScript, and Prisma expert instructions. |
| **`ui-ux-pro-max`** | Premium UI/UX design standards and component patterns. |

## 📊 Analysis & Research
| Skill | Purpose |
| :--- | :--- |
| **`qingyan-research`** | Deep academic and technical research agent. |
| **`contentanalysis`** | Deep linguistic and sentiment analysis of text. |

## 📄 Document Processing
| Skill | Purpose |
| :--- | :--- |
| **`pdf`** | Parsing and interacting with PDF documents. |
| **`docx`** | Generating and editing Microsoft Word files. |
| **`xlsx`** | Advanced Excel automation and data processing. |
| **`ppt`** | Creating and formatting PowerPoint presentations. |

## 🛠️ System Tools
| Skill | Purpose |
| :--- | :--- |
| **`skill-creator`** | An agent dedicated to helping you build *more* skills. |
| **`skill-vetter`** | Audits existing skills for security and efficiency. |
| **`auto-target-tracker`** | Project management and milestone tracking. |

---

## 📂 Full List of Available Skills
You can find these in `c:\opencode\glm-skills\`:

- `anti-pua`
- `blog-writer`
- `dream-interpreter`
- `interview-designer`
- `mindfulness-meditation`
- `storyboard-manager`
- ... and many more.

---

## 💡 How to use a GLM Skill

GLM Skills are managed via the **OpenCode CLI**. Each skill is registered in the [**`glm-skills.json`**](glm-skills/glm-skills.json) registry to ensure compatibility with the OpenCode engine.

### Loading a Skill
To activate a GLM skill for an agent, use the following command structure:
```bash
opencode skill load <skill-id>
```

### Script Adaptation
All legacy scripts (e.g., from `clawdhub`) have been adapted to the OpenCode environment. You can run skill-specific scripts via:
```bash
opencode skill run <skill-id>:<script-name>
```

---

> [!IMPORTANT]
> The [**`glm-skills.json`**](file:///c:/opencode/glm-skills/glm-skills.json) file is the source of truth for all external GLM integrations. If you add a new skill to the `glm-skills/` directory, ensure you register it in this JSON file to enable it for your agents.

---

> [!TIP]
> Use the **`skill-finder-cn`** skill if you are looking for specific community-contributed skills from the Zhipu AI ecosystem.
