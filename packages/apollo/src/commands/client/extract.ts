import { createHash } from "crypto";
import { writeFileSync } from "fs";
import {
  printWithReducedWhitespace,
  sortAST,
  defaultSignature as engineDefaultSignature
} from "apollo-engine-reporting";
import { DocumentNode } from "graphql";

import { ClientCommand } from "../../Command";
import { hideCertainLiterals } from "./push";

// XXX this is duplicated code
const manifestOperationHash = (str: string): string =>
  createHash("sha256")
    .update(str)
    .digest("hex");

const engineSignature = (_TODO_operationAST: DocumentNode): string => {
  // TODO.  We don't currently have access to the operation name since it's
  // currently omitted by the `apollo-codegen-core` package logic.
  return engineDefaultSignature(_TODO_operationAST, "TODO");
};

export default class ClientExtract extends ClientCommand {
  static description = "Extract queries from a client";
  static flags = {
    ...ClientCommand.flags
  };
  // not a public feature for now
  // static hidden = true;

  static args = [
    {
      name: "output",
      description: "Path to write the extracted queries to",
      required: true,
      default: "manifest.json"
    }
  ];

  async run() {
    console.time("ClientExtract#run");

    const { clientIdentity, operations, filename }: any = await this.runTasks(
      ({ flags, project, config, args }) => [
        {
          title: "Extracting operations from project",
          task: async ctx => {
            console.time("Extracting operations from project");
            const operations = Object.values(
              this.project.mergedOperationsAndFragmentsForService
            ).map(operationAST => {
              // While this could include dropping unused definitions, they are
              // kept because the registered operations should mirror those in the
              // client bundle minus any PII which lives within string literals.
              const printed = printWithReducedWhitespace(
                sortAST(hideCertainLiterals(operationAST))
              );

              return {
                signature: manifestOperationHash(printed),
                document: printed,
                metadata: {
                  engineSignature: engineSignature(operationAST)
                }
              };
            });

            ctx.operations = operations;
            ctx.clientIdentity = config.client;
            console.timeEnd("Extracting operations from project");
          }
        },
        {
          title: "Outputing extracted queries",
          task: (ctx, task) => {
            console.time("Outputing extracted queries");

            const filename = args.output;
            task.title = "Outputing extracted queries to " + filename;
            ctx.filename = filename;
            writeFileSync(
              filename,
              JSON.stringify(
                { version: 1, operations: ctx.operations },
                null,
                2
              )
            );
            console.timeEnd("Outputing extracted queries");
            console.log("\n");
            console.log("\n");
          }
        }
      ]
    );

    this.log(
      `Successfully wrote ${operations.length} operations from the ${
        clientIdentity.name
      } client to ${filename}`
    );

    console.timeEnd("ClientExtract#run");
  }
}
