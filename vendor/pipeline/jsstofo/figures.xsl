<?xml version="1.0" encoding="UTF-8"?>
<!-- ********************************************************************
     JSS to XSL-FO: Figures

     Stencil convention: centered image with a bold centered caption BELOW it,
     numbered "Figure <chapter>-<n>".
     ******************************************************************** -->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0"
  xmlns:fo="http://www.w3.org/1999/XSL/Format">

    <xsl:template match="figure">
        <!-- The figure is NOT force-kept-together as a whole. Each graphic is
             kept intact individually and the caption stays with the last image,
             but the image(s) + caption + a long callout key are allowed to FLOW
             across pages. Forcing the whole thing onto one page was what made a
             big legend (or several images) overrun the page bottom and collide
             with the footer. -->
        <fo:block space-before="4mm" space-after="5mm" text-align="center"
                  start-indent="0mm" end-indent="0mm">
            <xsl:attribute name="id">
                <xsl:call-template name="element-id"/>
            </xsl:attribute>
            <xsl:for-each select="graphic | image">
                <fo:block keep-together.within-page="always">
                    <xsl:if test="position() != last()">
                        <xsl:attribute name="space-after">3mm</xsl:attribute>
                    </xsl:if>
                    <xsl:apply-templates select="."/>
                </fo:block>
            </xsl:for-each>
            <xsl:if test="title">
                <fo:block font-weight="bold"
                          font-size="{$table-font-size}"
                          space-before="2mm"
                          keep-with-previous.within-page="always">
                    <xsl:text>Figure </xsl:text>
                    <xsl:call-template name="figure-number"/>
                    <xsl:text>: </xsl:text>
                    <xsl:apply-templates select="title" mode="text"/>
                </fo:block>
            </xsl:if>
            <xsl:apply-templates select="legend"/>
        </fo:block>
    </xsl:template>

    <!-- ==================================================================== -->
    <!--                          FIGURE LEGEND (KEY)                          -->
    <!-- ==================================================================== -->
    <!-- The callout key: item number -> part name, in $figure.legend.cols
         columns, filled left-to-right then top-to-bottom. Numbers are bold and
         sit in a narrow sub-column so the names line up. Left-aligned (a centred
         key would leave the numbers ragged). -->
    <xsl:template match="legend">
        <xsl:if test="keyitem">
            <xsl:variable name="cols" select="number($figure.legend.cols)"/>
            <fo:table table-layout="fixed" width="100%"
                      font-size="{$table-font-size}" text-align="left"
                      space-before="2mm" space-after="1mm">
                <xsl:call-template name="legend-cols">
                    <xsl:with-param name="n" select="$cols"/>
                </xsl:call-template>
                <fo:table-body>
                    <!-- One row per group of $cols items (row-major). -->
                    <xsl:for-each select="keyitem[position() mod $cols = 1 or $cols = 1]">
                        <fo:table-row>
                            <xsl:for-each select=". | following-sibling::keyitem[position() &lt; $cols]">
                                <fo:table-cell padding-top="0.6mm" padding-bottom="0.6mm">
                                    <fo:list-block provisional-distance-between-starts="9mm"
                                                   provisional-label-separation="2mm">
                                        <fo:list-item>
                                            <fo:list-item-label end-indent="label-end()">
                                                <fo:block font-weight="bold"><xsl:value-of select="@num"/></fo:block>
                                            </fo:list-item-label>
                                            <fo:list-item-body start-indent="body-start()">
                                                <fo:block><xsl:value-of select="."/></fo:block>
                                            </fo:list-item-body>
                                        </fo:list-item>
                                    </fo:list-block>
                                </fo:table-cell>
                            </xsl:for-each>
                        </fo:table-row>
                    </xsl:for-each>
                </fo:table-body>
            </fo:table>
        </xsl:if>
    </xsl:template>

    <!-- Emit $n equal-width fo:table-columns. -->
    <xsl:template name="legend-cols">
        <xsl:param name="n"/>
        <xsl:if test="$n &gt;= 1">
            <fo:table-column column-width="proportional-column-width(1)"/>
            <xsl:call-template name="legend-cols">
                <xsl:with-param name="n" select="$n - 1"/>
            </xsl:call-template>
        </xsl:if>
    </xsl:template>

    <!--
      Image sizing gives the author full control, page-aware.

        * A requested width/height is honoured exactly, capped only at the
          usable area of the page the figure actually sits on (portrait A4,
          A4 landscape or A3 landscape). The cap only ever prevents an image
          running off that page - it never shrinks a value that fits.
        * With no size, the image scales to the full usable width of its page
          and takes its natural height (no reserved white space).

      To fill a page, set width/height to (or beyond) the page's usable area:
      the value is clamped to the page and the image scales up to it. Because
      the cap follows the page, the same "fill" values work whether the figure
      is portrait A4, A4 landscape or A3 landscape.
    -->
    <xsl:template match="graphic | image">
        <xsl:variable name="orient">
            <xsl:call-template name="effective-orientation"/>
        </xsl:variable>
        <xsl:variable name="capW">
            <xsl:choose>
                <xsl:when test="$orient = 'a3-landscape'"><xsl:value-of select="$graphic.cap.a3landscape.w"/></xsl:when>
                <xsl:when test="$orient = 'landscape'"><xsl:value-of select="$graphic.cap.landscape.w"/></xsl:when>
                <xsl:otherwise><xsl:value-of select="$graphic.cap.portrait.w"/></xsl:otherwise>
            </xsl:choose>
        </xsl:variable>
        <xsl:variable name="capH">
            <xsl:choose>
                <xsl:when test="$orient = 'a3-landscape'"><xsl:value-of select="$graphic.cap.a3landscape.h"/></xsl:when>
                <xsl:when test="$orient = 'landscape'"><xsl:value-of select="$graphic.cap.landscape.h"/></xsl:when>
                <xsl:otherwise><xsl:value-of select="$graphic.cap.portrait.h"/></xsl:otherwise>
            </xsl:choose>
        </xsl:variable>

        <xsl:variable name="iw" select="number(@intrinsic-w)"/>
        <xsl:variable name="ih" select="number(@intrinsic-h)"/>

        <xsl:choose>
            <!--
              Exact fit. When the image's pixel dimensions are known (the server
              stamps intrinsic-w/-h), the viewport is set to the image's real
              scaled size, so it never reserves empty space (no gap before the
              caption) and never overflows (fits within the page caps).

              The bounding box starts from any requested width/height (each
              clamped to the page), or the page caps when unset, and the image's
              own aspect ratio is then fitted inside it.
            -->
            <xsl:when test="$iw &gt; 0 and $ih &gt; 0">
                <!-- The image's natural print size in mm (pixels at 96 dpi):
                     mm = px * 25.4 / 96 = px * 254 / 960. -->
                <xsl:variable name="natW" select="$iw * 254 div 960"/>
                <xsl:variable name="natH" select="$ih * 254 div 960"/>
                <!--
                  Bounding box: an explicit width/height (capped to the page),
                  otherwise the natural size (also capped). Basing the default on
                  the natural size, not the page cap, is what keeps the viewport
                  tight around a small image so no empty space is reserved.
                -->
                <xsl:variable name="bw0">
                    <xsl:call-template name="box-dim">
                        <xsl:with-param name="v" select="@width"/>
                        <xsl:with-param name="nat" select="$natW"/>
                        <xsl:with-param name="cap" select="$capW"/>
                    </xsl:call-template>
                </xsl:variable>
                <xsl:variable name="bh0">
                    <xsl:call-template name="box-dim">
                        <xsl:with-param name="v" select="@height"/>
                        <xsl:with-param name="nat" select="$natH"/>
                        <xsl:with-param name="cap" select="$capH"/>
                    </xsl:call-template>
                </xsl:variable>
                <!-- Fit the aspect ratio inside bw0 x bh0: width-bound unless
                     that would exceed the box height, then height-bound. -->
                <xsl:variable name="fitH" select="$bw0 * $ih div $iw"/>
                <xsl:variable name="bw">
                    <xsl:choose>
                        <xsl:when test="$fitH &lt;= $bh0"><xsl:value-of select="$bw0"/></xsl:when>
                        <xsl:otherwise><xsl:value-of select="$bh0 * $iw div $ih"/></xsl:otherwise>
                    </xsl:choose>
                </xsl:variable>
                <xsl:variable name="bh">
                    <xsl:choose>
                        <xsl:when test="$fitH &lt;= $bh0"><xsl:value-of select="$fitH"/></xsl:when>
                        <xsl:otherwise><xsl:value-of select="$bh0"/></xsl:otherwise>
                    </xsl:choose>
                </xsl:variable>
                <!-- scale-to-fit (not scale-DOWN): the box matches the image
                     aspect, so the image fills it exactly, scaling up when an
                     explicit size asks for more than the natural size. -->
                <fo:block>
                    <fo:external-graphic src="url('{@src}')"
                                         width="{$bw}mm" height="{$bh}mm"
                                         content-width="scale-to-fit"
                                         content-height="scale-to-fit"
                                         scaling="uniform"/>
                </fo:block>
            </xsl:when>

            <!--
              Fallback when the pixel size is unknown (image missing/unreadable):
              width fills the region; a landscape page also caps the height so a
              tall image cannot overrun the shallow page.
            -->
            <xsl:otherwise>
                <xsl:variable name="w">
                    <xsl:choose>
                        <xsl:when test="@width != ''">
                            <xsl:call-template name="clamp-mm">
                                <xsl:with-param name="v" select="@width"/>
                                <xsl:with-param name="cap" select="$capW"/>
                            </xsl:call-template>
                        </xsl:when>
                        <xsl:otherwise><xsl:value-of select="$graphic.default.width"/></xsl:otherwise>
                    </xsl:choose>
                </xsl:variable>
                <xsl:variable name="h">
                    <xsl:choose>
                        <xsl:when test="@height != ''">
                            <xsl:call-template name="clamp-mm">
                                <xsl:with-param name="v" select="@height"/>
                                <xsl:with-param name="cap" select="$capH"/>
                            </xsl:call-template>
                        </xsl:when>
                        <xsl:when test="$orient != ''"><xsl:value-of select="concat($capH, 'mm')"/></xsl:when>
                    </xsl:choose>
                </xsl:variable>
                <fo:block>
                    <fo:external-graphic src="url('{@src}')"
                                         content-width="scale-down-to-fit"
                                         scaling="uniform">
                        <xsl:if test="$w != ''">
                            <xsl:attribute name="width"><xsl:value-of select="$w"/></xsl:attribute>
                        </xsl:if>
                        <xsl:if test="$h != ''">
                            <xsl:attribute name="height"><xsl:value-of select="$h"/></xsl:attribute>
                            <xsl:attribute name="content-height">scale-down-to-fit</xsl:attribute>
                        </xsl:if>
                    </fo:external-graphic>
                </fo:block>
            </xsl:otherwise>
        </xsl:choose>
    </xsl:template>

    <!--
      One bounding-box dimension, in millimetres, as a bare number:
        * explicit mm value  -> that value, capped at the page ($cap)
        * otherwise          -> the natural size ($nat), capped at the page
      Basing the unsized default on the natural size keeps the viewport tight
      around the image so no empty space is reserved before the caption.
    -->
    <xsl:template name="box-dim">
        <xsl:param name="v"/>
        <xsl:param name="nat"/>
        <xsl:param name="cap"/>
        <xsl:variable name="s" select="normalize-space($v)"/>
        <xsl:variable name="want">
            <xsl:choose>
                <xsl:when test="substring($s, string-length($s) - 1) = 'mm'">
                    <xsl:value-of select="number(substring($s, 1, string-length($s) - 2))"/>
                </xsl:when>
                <xsl:otherwise><xsl:value-of select="$nat"/></xsl:otherwise>
            </xsl:choose>
        </xsl:variable>
        <xsl:choose>
            <xsl:when test="$want = $want and $want &lt; $cap"><xsl:value-of select="$want"/></xsl:when>
            <xsl:otherwise><xsl:value-of select="$cap"/></xsl:otherwise>
        </xsl:choose>
    </xsl:template>

    <!--
      Clamp a millimetre length to $cap (a bare number of mm). Values in other
      units or percentages pass through untouched, so "100%" still means the
      full region.
    -->
    <xsl:template name="clamp-mm">
        <xsl:param name="v"/>
        <xsl:param name="cap"/>
        <xsl:variable name="s" select="normalize-space($v)"/>
        <xsl:choose>
            <xsl:when test="substring($s, string-length($s) - 1) = 'mm'">
                <xsl:variable name="n" select="number(substring($s, 1, string-length($s) - 2))"/>
                <xsl:choose>
                    <xsl:when test="$n = $n and $n &gt; $cap">
                        <xsl:value-of select="concat($cap, 'mm')"/>
                    </xsl:when>
                    <xsl:otherwise><xsl:value-of select="$s"/></xsl:otherwise>
                </xsl:choose>
            </xsl:when>
            <xsl:otherwise><xsl:value-of select="$s"/></xsl:otherwise>
        </xsl:choose>
    </xsl:template>

    <!-- Placeholder frame, matching the stencil's "<<Image showing ...>>" boxes -->
    <xsl:template match="figurePlaceholder">
        <fo:block border="0.6pt solid #4472C4"
                  padding="20mm 4mm"
                  text-align="center"
                  font-weight="bold"
                  font-size="{$table-font-size}"
                  space-after="2mm">
            <xsl:apply-templates/>
        </fo:block>
    </xsl:template>

    <xsl:template match="figure/title"/>

</xsl:stylesheet>
