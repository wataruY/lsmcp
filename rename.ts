import { Project } from "ts-morph";

const project = new Project({
  tsConfigFilePath: "tsconfig.json",
  manipulationSettings: {
    usePrefixAndSuffixTextForRename: true,
  },
});
const file = project.getSourceFiles();
console.log(file.length);
