import { HttpClient } from '@angular/common/http';
import { Component, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import Map from 'ol/Map';
import View from 'ol/View';
import Draw from 'ol/interaction/Draw';
import Modify from 'ol/interaction/Modify';
import Snap from 'ol/interaction/Snap';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import { get } from 'ol/proj';
import { GeometryType } from 'ol/render/webgl/MixedGeometryBatch';
import OSM from 'ol/source/OSM';
import VectorSource from 'ol/source/Vector';
import { GeoJSON } from 'ol/format';
import Feature from 'ol/Feature';
import { WfsService } from '@services/wfs.service';
import {
  GeoJsonFeatureCollection,
  InteractionTypes,
  OlEvents,
  Projections,
} from '@models/geojson';
import { click } from 'ol/events/condition';
import { Select } from 'ol/interaction';
import Style from 'ol/style/Style';
import Fill from 'ol/style/Fill';
import Stroke from 'ol/style/Stroke';
import { CommonModule } from '@angular/common';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-map',
  imports: [
    CommonModule,
    MatRadioModule,
    MatSelectModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss'],
})
export class MapComponent implements AfterViewInit {
  @ViewChild('mapElement') mapElement!: ElementRef;
  @ViewChild('typeSelect') typeSelect!: ElementRef;

  label = 'draw';
  map!: Map;
  private readonly source = new VectorSource();
  private draw!: Draw;
  private modify!: Modify;
  private snap!: Snap;
  private select!: Select;
  private vector!: VectorLayer;
  selectedFeatures: Feature[] = [];

  constructor(readonly http: HttpClient, readonly wfsService: WfsService) {}

  ngAfterViewInit(): void {
    const defaultStyle = new Style({
      stroke: new Stroke({
        color: '#ffcc33',
        width: 5,
      }),
      fill: new Fill({
        color: 'rgba(255, 0, 0, 0.2)',
      }),
    });

    const raster = new TileLayer({ source: new OSM() });
    this.vector = new VectorLayer({
      source: this.source,
      style: defaultStyle,
    });

    const extent = get(Projections.EPSG_3857).getExtent().slice();
    extent[0] += extent[0];
    extent[2] += extent[2];

    this.map = new Map({
      target: this.mapElement.nativeElement,
      layers: [raster, this.vector],
      view: new View({
        center: [-11000000, 4600000],
        zoom: 4,
        extent: extent,
      }),
    });

    this.modify = new Modify({ source: this.source });
    this.map.addInteraction(this.modify);

    this.addInteractions();
    this.fetchMapFromServer();

    this.draw.on(OlEvents.DRAW_END, (event) => {
      const feature = event.feature;
      this.saveFeatureToGeoServer(feature);
    });

    const form = document.getElementById('options-form') as HTMLFormElement;
    form.addEventListener('change', () => this.onFormChange());
  }

  fileChange(event: any): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const geojson = e.target?.result as string;
      const features = new GeoJSON().readFeatures(geojson, {
        featureProjection: 'EPSG:3857',
      });
      this.vector.getSource().clear();
      this.vector.getSource().addFeatures(features);
      this.map.getView().fit(this.vector.getSource().getExtent(), {
        padding: [20, 20, 20, 20],
      });
    };
    reader.readAsText(file);
  }

  private onFormChange(): void {
    this.removeInteractions();

    const inputElement = document.querySelector(
      'input[name="interaction"]:checked'
    );

    const interactionType =
      inputElement && inputElement instanceof HTMLInputElement
        ? inputElement.value
        : undefined;

    const drawType = (document.getElementById('draw-type') as HTMLSelectElement)
      ?.value as GeometryType;

    if (interactionType === InteractionTypes.DRAW) {
      this.addDrawInteraction(drawType);
    } else if (interactionType === InteractionTypes.MODIFY) {
      this.addModifyInteraction();
    } else if (interactionType === InteractionTypes.DELETE) {
      this.addDeleteInteraction();
    }
  }

  private addDrawInteraction(drawType: GeometryType): void {
    this.draw = new Draw({
      source: this.vector.getSource(),
      type: drawType,
    });
    this.snap = new Snap({ source: this.vector.getSource() });

    this.map.addInteraction(this.draw);
    this.map.addInteraction(this.snap);
  }

  private addModifyInteraction(): void {
    this.modify = new Modify({ source: this.vector.getSource() });

    this.modify.on(OlEvents.MODIFY_END, (event) => {
      const feature = event.features.getArray()[0];

      // Use GeoJSON to convert the feature to GeoJSON format
      const geojsonFormat = new GeoJSON();
      const geojsonData = geojsonFormat.writeFeatureObject(feature);

      const featureId = feature.getId() as string;
      // Send the WFS Transaction request to GeoServer
      this.wfsService.updateFeature(featureId, geojsonData).subscribe();
    });

    this.snap = new Snap({ source: this.vector.getSource() });
    this.map.addInteraction(this.modify);
    this.map.addInteraction(this.snap);
  }

  addDeleteInteraction() {
    const selected = new Style({
      fill: new Fill({
        color: '#eeeeee',
      }),
      stroke: new Stroke({
        color: 'rgba(255, 255, 255, 0.7)',
        width: 5,
      }),
    });

    this.select = new Select({
      condition: click,
      style: selected,
    });

    this.map.addInteraction(this.select);

    this.select.on('select', (event) => {
      const selectedFeatures = event.selected;
      this.selectedFeatures = selectedFeatures;
    });
  }

  deleteFeature() {
    const feature = this.selectedFeatures[0];
    const featureId = feature.getId();
    this.wfsService.deleteFeature(feature.getId()).subscribe(() => {
      this.vector.getSource().removeFeature(featureId);
    });
  }

  private removeInteractions(): void {
    if (this.select) {
      this.map.removeInteraction(this.select);
      this.select = undefined;
      this.selectedFeatures = [];
    }
    if (this.draw) {
      this.map.removeInteraction(this.draw);
      this.draw = undefined;
    }
    if (this.modify) {
      this.map.removeInteraction(this.modify);
      this.modify = undefined;
    }
    if (this.snap) {
      this.map.removeInteraction(this.snap);
      this.snap = undefined;
    }
  }

  fetchMapFromServer(): void {
    const format = new GeoJSON();

    this.wfsService
      .getGeojsonMap()
      .subscribe((response: GeoJsonFeatureCollection) => {
        const features = format.readFeatures(response, {
          dataProjection: Projections.EPSG_3857,
          featureProjection: Projections.EPSG_3857,
        });
        this.source.addFeatures(features);
      });
  }

  saveFeatureToGeoServer(feature: Feature): void {
    // Use GeoJSON to convert the feature to GeoJSON format
    const geojsonFormat = new GeoJSON();
    const geojsonData = geojsonFormat.writeFeatureObject(feature);

    // Create WFS Transaction XML request to insert the feature
    const transactionXml = this.wfsService.createWFSInsertRequest(geojsonData);

    // Send the WFS Transaction request to GeoServer
    this.wfsService.saveFeature(transactionXml).subscribe();
  }

  private addInteractions(): void {
    const drawType = (document.getElementById('draw-type') as HTMLSelectElement)
      ?.value as GeometryType;
    this.addDrawInteraction(drawType);
  }
}
