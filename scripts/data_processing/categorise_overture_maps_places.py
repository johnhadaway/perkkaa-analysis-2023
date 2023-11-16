import geopandas as gpd
import json
import os

base_dir = os.path.join(os.path.dirname(__file__), '..', '..')

config_path = os.path.join(base_dir, 'data', 'util', 'overture_maps_places_gehl_mapping_config.json')
data_path = os.path.join(base_dir, 'data', 'raw', 'places_helsinki_2023-10-19-alpha.geojson')
output_path = os.path.join(base_dir, 'data', 'processed', 'places_helsinki_2023-10-19-alpha-gehl-cat-min60perConfidence.geojson')
unmapped_output_path = os.path.join(base_dir, 'data', 'util', 'unmapped_categories.json')

with open(config_path) as file:
    config = json.load(file)

gehl_category_mappings = config['gehl_category_mappings']
unmapped_category = config['unmapped_category']

def map_categories(row):
    gehl_category = gehl_category_mappings.get(row['mainCategory'], unmapped_category)
    return gehl_category

data = gpd.read_file(data_path)
data = data[['commonName', 'mainCategory', 'confidence', 'geometry']]

mapped_data = data.apply(lambda row: map_categories(row), axis=1, result_type='expand')
data['GehlCategory'] = mapped_data
unmapped_categories = set(data[data['GehlCategory'] == unmapped_category]['mainCategory'].unique())
data = data[data['confidence'] > 0.6]
data.to_file(output_path, driver='GeoJSON')

with open(unmapped_output_path, 'w') as file:
    json.dump(list(unmapped_categories), file, indent=4)

print(f"Unmapped categories written to {unmapped_output_path}")