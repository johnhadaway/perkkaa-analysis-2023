import geopandas as gpd
import json
import os

base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
data_path = os.path.join(base_dir, 'data', 'raw', 'hsl-boardings-nov2016.geojson')
output_path = os.path.join(base_dir, 'data', 'processed', 'hsl-boardings-nov2016-min.geojson')

data = gpd.read_file(data_path)

columns_fi = ['OBJECTID', 'Nousijamaa', 'Nimi', 'Lyhyt_tunn', 'geometry']
columns_en = ['OBJECTID', 'passengers', 'name', 'lyhyt_tunn', 'geometry']

data = data[columns_fi]
data.columns = columns_en
 
data = data[['name', 'lyhyt_tunn', 'passengers', 'geometry']]
data = data.to_crs(epsg=4326)

data.to_file(output_path, driver='GeoJSON')