"""
New mObywatel template replacer — uses data-placeholder attributes.
"""
from datetime import datetime

import bleach


def replace_html_data_new(soup, new_data):
    """
    Replace data in the new mObywatel HTML template using data-placeholder attributes.
    Sanitizes all input values to prevent XSS.
    """

    def safe_get(key, default=""):
        value = new_data.get(key, default)
        return bleach.clean(
            str(value) if value is not None else default,
            tags=[],
            attributes={},
            strip=True,
        )

    def set_placeholder(name, value):
        el = soup.find(attrs={"data-placeholder": name})
        if el:
            el.string = value

    # Main card fields
    set_placeholder("mdowod_first_name", safe_get("imie"))
    set_placeholder("mdowod_last_name", safe_get("nazwisko"))
    set_placeholder("citizenship", safe_get("obywatelstwo"))
    set_placeholder("mdowod_birthday", safe_get("data_urodzenia"))
    set_placeholder("mdowod_pesel", safe_get("pesel"))

    # mDowód data card
    set_placeholder("mdowod_series", safe_get("seria_numer_mdowodu"))
    set_placeholder("mdowod_expiration", safe_get("termin_waznosci_mdowodu"))
    set_placeholder("mdowod_issue", safe_get("data_wydania_mdowodu"))
    set_placeholder("mdowod_fathers_name", safe_get("imie_ojca_mdowod"))
    set_placeholder("mdowod_mothers_name", safe_get("imie_matki_mdowod"))

    # Additional details
    set_placeholder("mdowod_family_name", safe_get("nazwisko_rodowe").capitalize())

    gender_map = {"M": "Mężczyzna", "K": "Kobieta"}
    raw_plec = safe_get("plec")
    set_placeholder("mdowod_gender", gender_map.get(raw_plec, raw_plec))

    set_placeholder(
        "mdowod_fathers_family", safe_get("nazwisko_rodowe_ojca").capitalize()
    )
    set_placeholder(
        "mdowod_mothers_family", safe_get("nazwisko_rodowe_matki").capitalize()
    )
    set_placeholder("mdowod_place_of_birth", safe_get("miejsce_urodzenia").capitalize())
    set_placeholder("mdowod_residence", safe_get("adres_zameldowania").capitalize())
    set_placeholder("mdowod_residence_date", safe_get("data_zameldowania"))

    # Identity card panel
    set_placeholder("personal_id_series", safe_get("seria_numer_dowodu"))
    set_placeholder("personal_id_expiration", safe_get("termin_waznosci_dowodu"))
    set_placeholder("personal_id_issue", safe_get("data_wydania_dowodu"))

    # Last update timestamps
    now_str = datetime.now().strftime("%d.%m.%Y, %H:%M")
    set_placeholder("mdowod_last_update", now_str)
    set_placeholder("last_update", now_str)

    # Photo
    img_tag = soup.find("img", id="user_photo")
    if img_tag and new_data.get("image_filename"):
        # src will be set by app.py via url_for after this function returns
        pass

    return soup
