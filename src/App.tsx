import ReactDOM from "react-dom/client";
import { Tldraw, Editor } from "tldraw";
import { FallingSand } from "./FallingSand";
import "tldraw/tldraw.css";
import "./css/index.css";
import { SandTool } from "./ui/SandTool";
import { uiOverrides } from "./ui/overrides";
import { uiComponents } from "./ui/components";

const tools = [SandTool];
const overrides = [uiOverrides];
const components = uiComponents;

const root = document.getElementById("root");
if (root) {
  ReactDOM.createRoot(root).render(
    <div className="tldraw__editor">
      <Tldraw
        persistenceKey="tldraw-sand"
        tools={tools}
        overrides={overrides}
        components={components}
        onMount={(editor: Editor) => {
          new FallingSand(editor);
        }}
      />
    </div>
  );
}
