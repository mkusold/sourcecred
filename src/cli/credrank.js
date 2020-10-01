// @flow

import fs from "fs-extra";
import stringify from "json-stable-stringify";
import {join as pathJoin} from "path";
import {format} from "d3-format";

import sortBy from "../util/sortBy";
import {credrank} from "../core/algorithm/credrank";
import {CredGraph} from "../core/credGraph";
import {NodeAddress, type Graph, type NodeAddressT} from "../core/graph";
import {LoggingTaskReporter} from "../util/taskReporter";
import {MarkovProcessGraph, type Participant} from "../core/markovProcessGraph";
import type {Command} from "./command";
import {makePluginDir, loadInstanceConfig} from "./common";
import {
  type WeightedGraph,
  merge,
  fromJSON as weightedGraphFromJSON,
} from "../core/weightedGraph";

const DEFAULT_ALPHA = 0.1;
const DEFAULT_BETA = 0.4;
const DEFAULT_GAMMA_FORWARD = 0.1;
const DEFAULT_GAMMA_BACKWARD = 0.1;

function die(std, message) {
  std.err("fatal: " + message);
  return 1;
}

const credrankCommand: Command = async (args, std) => {
  if (args.length !== 0) {
    return die(std, "usage: sourcecred credrank");
  }
  const taskReporter = new LoggingTaskReporter();
  taskReporter.start("credrank");

  const baseDir = process.cwd();
  const config = await loadInstanceConfig(baseDir);

  const plugins = Array.from(config.bundledPlugins.values());
  const declarations = plugins.map((x) => x.declaration());

  const graphOutputPrefix = ["output", "graphs"];
  async function loadGraph(pluginName): Promise<WeightedGraph> {
    const outputDir = makePluginDir(baseDir, graphOutputPrefix, pluginName);
    const outputPath = pathJoin(outputDir, "graph.json");
    const graphJSON = JSON.parse(await fs.readFile(outputPath));
    return weightedGraphFromJSON(graphJSON);
  }

  taskReporter.start("merge graphs");
  const pluginNames = Array.from(config.bundledPlugins.keys());
  const graphs = await Promise.all(pluginNames.map(loadGraph));
  const wg = merge(graphs);
  taskReporter.finish("merge graphs");

  taskReporter.start("create Markov process graph");
  // TODO: Support loading transition probability params from config.
  const fibrationOptions = {
    beta: DEFAULT_BETA,
    gammaForward: DEFAULT_GAMMA_FORWARD,
    gammaBackward: DEFAULT_GAMMA_BACKWARD,
  };
  const seedOptions = {
    alpha: DEFAULT_ALPHA,
  };
  const participants = findParticipants(
    wg.graph,
    [].concat(...declarations.map((d) => d.userTypes.map((t) => t.prefix)))
  );
  const mpg = MarkovProcessGraph.new(
    wg,
    participants,
    fibrationOptions,
    seedOptions
  );
  taskReporter.finish("create Markov process graph");

  taskReporter.start("run CredRank");
  const credGraph = await credrank(mpg);
  taskReporter.finish("run CredRank");

  taskReporter.start("write cred graph");
  const cgJson = stringify(credGraph.toJSON());
  const outputPath = pathJoin(baseDir, "output", "credGraph.json");
  await fs.writeFile(outputPath, cgJson);
  taskReporter.finish("write cred graph");

  printCredSummaryTable(credGraph);

  taskReporter.finish("credrank");
  return 0;
};

function printCredSummaryTable(credGraph: CredGraph) {
  console.log(`# Top Participants By Cred`);
  console.log(`| Description | Cred |`);
  console.log(`| --- | --- |`);
  const credParticipants = Array.from(credGraph.participants());
  const sortedParticipants = sortBy(credParticipants, (p) => -p.cred);
  const formatCred = format(".1d");
  sortedParticipants
    .slice(0, 10)
    .forEach((n) =>
      console.log(`| ${n.description} | ${formatCred(n.cred)} |`)
    );
}

function findParticipants(
  graph: Graph,
  scoringPrefixes: $ReadOnlyArray<NodeAddressT>
): $ReadOnlyArray<Participant> {
  const result = [];
  for (const {address, description} of graph.nodes()) {
    if (scoringPrefixes.some((p) => NodeAddress.hasPrefix(address, p))) {
      result.push({address, description});
    }
  }
  return result;
}

export default credrankCommand;
