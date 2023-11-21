import geopandas as gpd
import os
from shapely.geometry import box
import pandas as pd
from tqdm import tqdm

def create_transformed_bbox(sw, ne, from_crs, to_crs):
    """bounding box and transform it to the given crs"""
    bbox = box(sw[0], sw[1], ne[0], ne[1])
    return gpd.GeoSeries([bbox], crs=from_crs).to_crs(to_crs).iloc[0]

def calculate_buffered_categories(buildings, places, distances):
    """calculate categories within buffer distances for buildings"""
    for distance in distances:
        buffer = buildings.geometry.centroid.buffer(distance)
        buffered_buildings = gpd.sjoin(gpd.GeoDataFrame(geometry=buffer), places, how='left', predicate='intersects')
        category_columns = ['social', 'necessary', 'optional', 'other']
        
        for category in category_columns:
            cat_count = (buffered_buildings['GehlCategory'] == category).groupby(buffered_buildings.index).sum()
            buildings[f'{category}_places_within_{distance}m'] = cat_count

        buildings[f'places_within_{distance}m'] = buildings[[f'{c}_places_within_{distance}m' for c in category_columns]].sum(axis=1)
    return buildings

def calculate_simpson_diversity(buildings, categories, distance):
    """simpson's diversity index for each building"""
    div_col = f'simpson_diversity_within_{distance}m'
    buildings[div_col] = 0
    for index, building in tqdm(buildings.iterrows(), total=buildings.shape[0]):
        places_within_distance = building[f'places_within_{distance}m']
        if places_within_distance > 0:
            category_squares_sum = sum(
                (building[f'{category}_places_within_{distance}m'] / places_within_distance) ** 2
                for category in categories
            )
            buildings.at[index, div_col] = 1 - category_squares_sum
        else:
            buildings.at[index, div_col] = 0
    return buildings

base_dir = os.path.join(os.path.dirname(__file__), '..', '..')
buildings_path = os.path.join(base_dir, 'data', 'raw', 'helsinki-espoo-buildings-joined-16-11-2023.geojson')
places_path = os.path.join(base_dir, 'data', 'processed', 'places-helsinki-2023-10-19-alpha-gehl-cat-min-60per-confidence.geojson')
output_path = os.path.join(base_dir, 'data', 'processed', 'bay-buildings-joined-16-11-2023-elaborated.geojson')

buildings = gpd.read_file(buildings_path)
places = gpd.read_file(places_path).to_crs(buildings.crs)

SW = (24.781583, 60.165923)
NE = (24.909075, 60.232232)
CRS = 'EPSG:4326'
transformed_bbox = create_transformed_bbox(SW, NE, CRS, buildings.crs)

buildings = buildings[buildings.geometry.centroid.within(transformed_bbox)]

buffer_distances = [500, 1500]
buildings = calculate_buffered_categories(buildings, places, buffer_distances)
for distance in buffer_distances:
    buildings = calculate_simpson_diversity(buildings, ['social', 'necessary', 'optional', 'other'], distance)

buildings['dwellings_per_floors'] = buildings['number_of_dwellings'] / buildings['number_of_floors']
buildings['floor_area_per_dwelling'] =  buildings['floor_area'] / buildings['number_of_dwellings']
buildings['assumed_height_based_on_floors'] = buildings['number_of_floors'] * 3.3

buildings['completion_date_'] = pd.to_datetime(buildings['completion_date'], errors='coerce')
min_date = buildings['completion_date_'].min()
buildings['days_since_earliest'] = (buildings['completion_date_'] - min_date).dt.days
buildings['number_of_dwellings'] = pd.to_numeric(buildings['number_of_dwellings'].replace(0, None))


buildings = buildings.to_crs(4326)
buildings.to_file(output_path, driver='GeoJSON')
print(f"Updated dataset saved as {output_path}")