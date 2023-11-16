import geopandas as gpd
import json
import os

def load_config(config_path):
    with open(config_path) as file:
        return json.load(file)

def map_gehl_categories(data, category_mappings, unmapped_category):
    data['GehlCategory'] = data['mainCategory'].map(category_mappings).fillna(unmapped_category)
    return data

def save_unmapped_categories(data, unmapped_category, output_path):
    unmapped_categories = data[data['GehlCategory'] == unmapped_category]['mainCategory'].unique().tolist()
    with open(output_path, 'w') as file:
        json.dump(unmapped_categories, file, indent=4)

base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
config_path = os.path.join(base_dir, 'data', 'util', 'overture-maps-places-gehl-mapping-config.json')
data_path = os.path.join(base_dir, 'data', 'raw', 'places-helsinki-2023-10-19-alpha.geojson')
confidence_threshold = 0.6
output_filename = f'places-helsinki-2023-10-19-alpha-gehl-cat-min-{int(confidence_threshold*100)}per-confidence.geojson'
output_path = os.path.join(base_dir, 'data', 'processed', output_filename)
unmapped_output_path = os.path.join(base_dir, 'data', 'util', 'unmapped-categories.json')

config = load_config(config_path)
gehl_category_mappings = config['gehl_category_mappings']
unmapped_category = config['unmapped_category']
data = gpd.read_file(data_path)

data = data[['commonName', 'mainCategory', 'confidence', 'geometry']]
data = map_gehl_categories(data, gehl_category_mappings, unmapped_category)
data = data[data['confidence'] > confidence_threshold]

data.to_file(output_path, driver='GeoJSON')
save_unmapped_categories(data, unmapped_category, unmapped_output_path)

print(f"Processed data saved to {output_path}")
print(f"Unmapped categories written to {unmapped_output_path}")