<?xml version="1.0" encoding="UTF-8"?>
<!-- ********************************************************************
     JSS to XSL-FO: Notice boxes (NOTE / WARNING / CAUTION)

     Reproduces the banded notice style from the stencil's DESCRIPTION OF
     SYMBOLS page: a coloured title band with a warning glyph, and the notice
     text beneath, closed by a rule.
     ******************************************************************** -->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0"
  xmlns:fo="http://www.w3.org/1999/XSL/Format">

    <xsl:template match="note">
        <xsl:call-template name="notice-box">
            <xsl:with-param name="label">NOTE</xsl:with-param>
            <xsl:with-param name="band-color">#8DB4D8</xsl:with-param>
            <xsl:with-param name="italic">1</xsl:with-param>
        </xsl:call-template>
    </xsl:template>

    <xsl:template match="warning">
        <xsl:call-template name="notice-box">
            <xsl:with-param name="label">WARNING</xsl:with-param>
            <xsl:with-param name="band-color">#EE0000</xsl:with-param>
        </xsl:call-template>
    </xsl:template>

    <xsl:template match="caution">
        <xsl:call-template name="notice-box">
            <xsl:with-param name="label">CAUTION</xsl:with-param>
            <xsl:with-param name="band-color">#EE0000</xsl:with-param>
        </xsl:call-template>
    </xsl:template>

    <xsl:template name="notice-box">
        <xsl:param name="label"/>
        <xsl:param name="band-color"/>
        <xsl:param name="italic">0</xsl:param>
        <fo:block space-before="4mm" space-after="4mm" keep-together.within-page="always">
            <!-- Title band -->
            <fo:block background-color="{$band-color}"
                      color="white"
                      font-weight="bold"
                      font-size="9pt"
                      padding="1mm"
                      padding-left="2mm">
                <xsl:if test="$italic = '1'">
                    <xsl:attribute name="font-style">italic</xsl:attribute>
                </xsl:if>
                <!-- Base-14 fonts carry no warning-triangle glyph, so the
                     alert is drawn as a boxed exclamation mark. -->
                <fo:inline border="0.6pt solid white" padding-left="1mm" padding-right="1mm">!</fo:inline>
                <xsl:text>  </xsl:text>
                <xsl:value-of select="$label"/>
            </fo:block>
            <!-- Notice text. Capitals via text-transform rather than by
                 rewriting the string, so inline markup inside the notice
                 survives; both attributes are house settings. -->
            <fo:block padding-top="1mm"
                      padding-left="2mm"
                      padding-bottom="1mm"
                      border-bottom="0.8pt solid black">
                <xsl:if test="$notice.text.bold != '0'">
                    <xsl:attribute name="font-weight">bold</xsl:attribute>
                </xsl:if>
                <xsl:if test="$notice.text.caps != '0'">
                    <xsl:attribute name="text-transform">uppercase</xsl:attribute>
                </xsl:if>
                <xsl:apply-templates/>
            </fo:block>
        </fo:block>
    </xsl:template>

    <!-- Paragraphs inside a notice box are flush left, not indented -->
    <xsl:template match="note/para | warning/para | caution/para">
        <fo:block space-after="1.5mm"><xsl:apply-templates/></fo:block>
    </xsl:template>

</xsl:stylesheet>
