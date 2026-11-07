import type { Meta, StoryObj } from "@storybook/react-vite";
import { Frame } from "../../stories/Frames";
import { act, acts } from "../../stories/acts";
import { DocPaneActs, DocPaneHead, DocPaneNav } from "./DocPane";

const meta: Meta = { title: "UI/Document pane/Its bar, the pointer on it" };
export default meta;
type Story = StoryObj;

// what its buttons do needs the page (Comment mode, the editor, the move sheet, Taska): the Actions panel
const on = acts("Document pane", ["inspect", "whole", "copy", "edit", "move", "remove"] as const);
const bar = (children: React.ReactNode) => (
  <div className="flex h-14 items-center gap-1 border-b border-zinc-200 px-3 dark:border-zinc-800">
    {children}
  </div>
);

/** Reading a document, a web page in Comment mode with Delete asking, and editing: as wide as the pane in a 1440
 * window, and as narrow as in a 1100 one (B547: the buttons keep their icons, their words under the pointer). */
const bars = (width: number) => (
  <Frame
    layout="desk"
    width={width}
    height={200}
    label={width === 900 ? "a 1440 wide window" : "a 1100 wide window"}
  >
    {bar(
      <>
        <DocPaneNav to="F012" onBack={act("Document pane: back")} />
        <DocPaneHead
          d={{ d: 12, title: "The rewrite plan", fmt: "md" }}
          editing={false}
        />
        <span className="flex-1" />
        <DocPaneActs
          web={false}
          inspect={false}
          whole={false}
          deleting={false}
          on={on}
        />
      </>,
    )}
    {bar(
      <>
        <DocPaneNav to="Documents" onBack={act("Document pane: back")} />
        <DocPaneHead
          d={{ d: 13, title: "How the old page looks", fmt: "html" }}
          editing={false}
        />
        <span className="flex-1" />
        <DocPaneActs web inspect whole={false} deleting on={on} />
      </>,
    )}
    {bar(
      <DocPaneHead
        d={{ d: 12, title: "The rewrite plan", fmt: "md" }}
        editing
      />,
    )}
  </Frame>
);
export const Bars: Story = {
  name: "The pane's bar: a document, a web page, being edited",
  render: () => (
    <div className="flex flex-wrap items-start gap-6 bg-zinc-200 p-6 dark:bg-zinc-800">
      {bars(900)}
      {bars(500)}
    </div>
  ),
};
