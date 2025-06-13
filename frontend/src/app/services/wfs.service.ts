import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { GeoJsonFeatureCollection, Projections } from '@models/geojson';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class WfsService {
  geoserverUri = 'http://localhost:8080/geoserver/gadm';
  featureName = 'my_lines';

  constructor(private readonly http: HttpClient) {}

  getGeojsonMap(): Observable<GeoJsonFeatureCollection> {
    return this.http.get<GeoJsonFeatureCollection>(
      `${this.geoserverUri}/ows?service=WFS&version=1.1.0&request=GetFeature&typeName=${this.featureName}&outputFormat=application/json`
    );
  }

  createWFSInsertRequest(geojsonData: any): string {
    const coordinates = geojsonData.geometry.coordinates
      .map((coord: any) => `${coord[0]} ${coord[1]}`)
      .join(' ');

    // Create the WFS Transaction XML string
    return `
      <wfs:Transaction service="WFS" version="1.1.0"
                    xmlns:wfs="http://www.opengis.net/wfs"
                    xmlns:gml="http://www.opengis.net/gml"
                    xmlns:ns="http://localhost:8080/geoserver/gadm"
                    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                    xsi:schemaLocation="http://www.opengis.net/wfs
                    http://schemas.opengis.net/wfs/1.1.0/wfs.xsd">
        <wfs:Insert>
          <my_lines>
            <geom>
              <gml:LineString decimal="." cs="," ts=" " srsName="${Projections.EPSG_3857}">
                <gml:posList>${coordinates}</gml:posList>
              </gml:LineString>
            </geom>
          </my_lines>
        </wfs:Insert>
      </wfs:Transaction>
      `;
  }

  deleteFeature(id: string | number): Observable<any> {
    const transactionXml = `
        <wfs:Transaction service="WFS" version="1.1.0"
                        xmlns:wfs="http://www.opengis.net/wfs"
                        xmlns:ogc="http://www.opengis.net/ogc"
                        xmlns:ns="http://localhost:8080/geoserver/gadm"
                        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                        xsi:schemaLocation="http://www.opengis.net/wfs
                        http://schemas.opengis.net/wfs/1.1.0/wfs.xsd">
          <wfs:Delete typeName="ns:my_lines">
            <ogc:Filter>
              <ogc:FeatureId fid="${id}"/>
            </ogc:Filter>
          </wfs:Delete>
        </wfs:Transaction>
    `;
    return this.http.post(`${this.geoserverUri}/wfs`, transactionXml, {
      headers: { 'Content-Type': 'application/xml' },
      responseType: 'text',
    });
  }

  saveFeature(transactionXml: string): Observable<any> {
    return this.http.post(`${this.geoserverUri}/wfs`, transactionXml, {
      headers: { 'Content-Type': 'application/xml' },
      responseType: 'text',
    });
  }

  updateFeature(id: string, geojsonData: any) {
    const coordinates = geojsonData.geometry.coordinates
      .map((coord: any) => `${coord[0]} ${coord[1]}`)
      .join(' ');

    const transactionXml = `
      <wfs:Transaction service="WFS" version="1.1.0"
                      xmlns:wfs="http://www.opengis.net/wfs"
                      xmlns:gml="http://www.opengis.net/gml"
                      xmlns:ogc="http://www.opengis.net/ogc"
                      xmlns:ns="http://localhost:8080/geoserver/gadm"
                      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                      xsi:schemaLocation="http://www.opengis.net/wfs
                                          http://schemas.opengis.net/wfs/1.1.0/wfs.xsd">
        <wfs:Update typeName="ns:my_lines">
          <wfs:Property>
            <wfs:Name>geom</wfs:Name>
            <wfs:Value>
              <gml:LineString srsName="EPSG:3857" decimal="." cs="," ts=" ">
                <gml:posList>${coordinates}</gml:posList>
              </gml:LineString>
            </wfs:Value>
          </wfs:Property>
          <ogc:Filter>
            <ogc:FeatureId fid="${id}"/>
          </ogc:Filter>
        </wfs:Update>
      </wfs:Transaction>`;

    return this.http.post(`${this.geoserverUri}/wfs`, transactionXml, {
      headers: { 'Content-Type': 'application/xml' },
      responseType: 'text',
    });
  }
}
