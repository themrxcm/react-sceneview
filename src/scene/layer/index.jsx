/* Copyright 2018 Esri
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

import React, { Component } from 'react';
import PropTypes from 'prop-types';

import { loadLayer } from './load';

import Graphic from './graphic';
import { applyUpdates } from './update';

export const layerSettingsProps = {
  id: PropTypes.string.isRequired,
  url: PropTypes.string,
  portalItem: PropTypes.object,
  layerType: PropTypes.oneOf([
    'feature',
    'scene',
    'tile',
    'vector-tile',
    'integrated-mesh',
    'point-cloud',
    'building-scene',
  ]).isRequired,
  visible: PropTypes.bool,
  definitionExpression: PropTypes.string,
  renderer: PropTypes.object,
  rendererJson: PropTypes.object,
  labelingInfo: PropTypes.object,
  labelsVisible: PropTypes.bool,
  outFields: PropTypes.arrayOf(PropTypes.string),
  elevationInfo: PropTypes.object,
  geometryType: PropTypes.string,
  hasZ: PropTypes.bool,
  fields: PropTypes.array,
  objectIdField: PropTypes.string,
  objectIdFilter: PropTypes.object,
  selectable: PropTypes.bool,
  relatedLayer: PropTypes.string,
  spatialReference: PropTypes.object,
  opacity: PropTypes.number,
  minScale: PropTypes.number,
  maxScale: PropTypes.number,
  featureReduction: PropTypes.object,
  source: PropTypes.array,
  legendEnabled: PropTypes.bool,
  title: PropTypes.string,
  maskingGeometry: PropTypes.object,
  popupEnabled: PropTypes.bool,
  popupTemplate: PropTypes.object,
  onLoad: PropTypes.func,
};


const getLayerSettings = (props) => {
  const settings = {};

  Object.keys(layerSettingsProps)
    .filter(key => props.layerType !== 'point-cloud' || key !== 'opacity')
    .filter(key => props[key] !== null && props[key] !== undefined)
    .forEach(key => settings[key] = props[key]);

  return settings;
};


const getOIDfromGlobalId = (layerView, GlobalID) => {
  const graphic = layerView.controller.graphics.find(e => e.attributes.GlobalID === GlobalID);

  if (!graphic) return null;
  return graphic.attributes[layerView.layer.objectIdField];
};


const getHighlightOIDs = (layerView, mysteryIds) => mysteryIds.map(mysteryId => (
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(mysteryId) ?
    getOIDfromGlobalId(layerView, mysteryId) : mysteryId
));


class Layer extends Component {
  static getDerivedStateFromProps(props, state) {
    const newState = {
      highlights: props.highlight && props.highlight.length &&
        state.layerView && state.layerView.highlight &&
        state.layerView.highlight(getHighlightOIDs(state.layerView, props.highlight)),
    };

    if (state.highlights) state.highlights.remove();

    return newState;
  }

  constructor(props) {
    super(props);
    this.state = {
      layer: null,
      layerView: null,
      highlights: null,
    };
  }


  componentDidMount() {
    this.componentIsMounted = true;
    const layerSettings = getLayerSettings(this.props);
    this.load(this.props.view, layerSettings);
  }


  async componentDidUpdate(prevProps) {
    if (!this.state.layer) return;
    if (!Object.keys(prevProps).find(key => prevProps[key] !== this.props[key])) return;

    // refresh layer
    if (this.props.refresh !== prevProps.refresh) {
      this.state.layerView.refresh();
    }

    await applyUpdates(prevProps, this.props, this.state.layer, this.state.layerView);
  }


  componentWillUnmount() {
    this.componentIsMounted = false;
    if (!this.state.layer) return;

    // TODO: this prob. needs to be changed
    if (this.state.layer.source && this.state.layer.source.removeAll) {
      this.state.layer.source.removeAll();
    }

    this.props.view.map.layers.remove(this.state.layer);
  }


  async load(view, layerSettings) {
    if (!view) return;

    // Check if already exists (e.g., after hot reload)
    const existingLayer = view.map.layers.items.find(l => l.id === layerSettings.id);
    const layer = existingLayer || await loadLayer(layerSettings);

    // After every await, need to check if component is still mounted
    if (!this.componentIsMounted || !layer) return;

    // Add layer to map
    view.map.add(layer);
    const layerView = await view.whenLayerView(layer);

    // After every await, need to check if component is still mounted
    if (!this.componentIsMounted) {
      view.map.remove(layer);
      return;
    }

    await layer.when();
    await applyUpdates(layerSettings, this.props, this.state.layer, this.state.layerView);

    if (this.props.selection && this.props.selection.length) {
      this.setState({ highlights: this.state.layerView.highlight(this.props.selection) });
    }

    this.setState({
      layer,
      layerView,
    });

    this.props.onLoad(layer);
  }

  render() {
    return this.state.layer && (
      <div>
        {this.props.children && React.Children.map(this.props.children, child =>
          child && React.cloneElement(child, { layer: this.state.layer }))}
      </div>
    );
  }
}


Layer.propTypes = {
  children: PropTypes.node,
  ...layerSettingsProps,
  refresh: PropTypes.number,
  highlight: PropTypes.array,
  view: PropTypes.object.isRequired,
};


Layer.defaultProps = {
  children: null,
  url: null,
  portalItem: null,
  visible: true,
  selectable: false,
  relatedLayer: null,
  definitionExpression: null,
  renderer: null,
  rendererJson: null,
  labelingInfo: null,
  labelsVisible: false,
  outFields: ['*'],
  elevationInfo: null,
  geometryType: null,
  hasZ: false,
  fields: null,
  objectIdField: null,
  objectIdFilter: null,
  spatialReference: null,
  refresh: null,
  highlight: [],
  opacity: null,
  minScale: null,
  maxScale: null,
  featureReduction: null,
  source: null,
  legendEnabled: true,
  title: null,
  maskingGeometry: null,
  popupEnabled: false,
  popupTemplate: null,
  onLoad: () => null,
};

Layer.Graphic = Graphic;

export { Layer, Graphic };

export default Layer;
